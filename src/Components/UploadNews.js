import { React, useState, useEffect, useRef } from "react";
import {
  setDoc,
  doc,
  dbForUploadNews as db,
  storage,
  auth,
  serverTimestamp,
  collection,
  getDocs,
  orderBy,
  query as fquery,
  limit,
} from "../firebase.config";
import "../CSS/UploadNews.css";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";

const UploadNews = () => {
  const ADMIN_EMAIL = process.env.REACT_APP_ADMIN_EMAIL || "";
  const DRAFT_STORAGE_KEY = "uploadNewsDraft";
  const SESSION_ACTIVITY_KEY = "uploadNewsLastActiveAt";
  const SESSION_TIMEOUT_MS = 10 * 60 * 1000;
  const COVER_TARGET_WIDTH = 1200;
  const COVER_TARGET_HEIGHT = 630;
  const COVER_JPEG_QUALITY = 0.82;
  const COLLECTION_TARGETS = [
    { key: "blogs", label: "Blogs (Default)" },
    { key: "Anonymous", label: "Anonymous" },
    { key: "Articles", label: "Articles" },
  ];
  const CATEGORY_OPTIONS = [
    "Crime",
    "Development",
    "Village / Guthani",
    "Administration",
    "Politics",
    "Education",
    "Health",
    "Sports",
    "Business",
    "Other",
  ];
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [excerpts, setExcerpts] = useState("");
  const [clip] = useState("");
  const [imageURL, setImageURL] = useState("");
  const [id, setId] = useState("");
  const [file, setFile] = useState("");
  const [newsNumber, setNewsNumber] = useState(1000);
  const [percent, setPercent] = useState(0);
  const [inlineFiles, setInlineFiles] = useState([]);
  const [inlinePercent, setInlinePercent] = useState(0);
  const [inlineImageUrls, setInlineImageUrls] = useState([]);
  const [showInlineUploader, setShowInlineUploader] = useState(false);
  const [isInlineUploading, setIsInlineUploading] = useState(false);
  const [selectedValue, setSelectedValue] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [sessionInfo, setSessionInfo] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isCoverProcessing, setIsCoverProcessing] = useState(false);
  const [coverProcessingInfo, setCoverProcessingInfo] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [selectedPublishCollection, setSelectedPublishCollection] = useState("blogs");
  const [confirmProtectedPublish, setConfirmProtectedPublish] = useState(false);
  const [showTranslateDialog, setShowTranslateDialog] = useState(false);
  const [translationDirection, setTranslationDirection] = useState("hi-en");
  const [translationInput, setTranslationInput] = useState("");
  const [translationOutput, setTranslationOutput] = useState("");
  const [translationError, setTranslationError] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);
  const isCoverUploaded = imageURL !== "";
  const coverInputRef = useRef(null);
  const inlineInputRef = useRef(null);
  const isAuthorized = Boolean(authUser) && (!ADMIN_EMAIL || authUser?.email === ADMIN_EMAIL);

  const handleSelectChange = (event) => {
    setSelectedValue(event.target.value);
  };

  function handleChange(event) {
    setFile(event.target.files[0]);
    setCoverProcessingInfo("");
  }

  function handleInlineFilesChange(event) {
    const files = Array.from(event.target.files || []);
    setInlineFiles(files);
  }

  const formatNewsLink = (value) => {
    return String(value || "")
      .trim()
      .replace(/[^A-Za-z0-9\u0900-\u097F]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  };

  const getFriendlyError = (fallbackMessage) => {
    return fallbackMessage;
  };

  const handleInputChange = (event) => {
    setId(formatNewsLink(event.target.value));
  };

  const resolvedCategory = selectedCategory === "Other" ? customCategory.trim() : selectedCategory;
  const hasProtectedTarget = selectedPublishCollection !== "blogs";

  const optimizeCoverImage = async (originalFile) => {
    const imageDataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Unable to read image file."));
      reader.readAsDataURL(originalFile);
    });

    const loadedImage = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Unable to load image."));
      image.src = imageDataUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = COVER_TARGET_WIDTH;
    canvas.height = COVER_TARGET_HEIGHT;
    const context = canvas.getContext("2d");
    if (!context) {
      return originalFile;
    }

    const sourceWidth = loadedImage.naturalWidth;
    const sourceHeight = loadedImage.naturalHeight;
    const sourceRatio = sourceWidth / sourceHeight;
    const targetRatio = COVER_TARGET_WIDTH / COVER_TARGET_HEIGHT;
    let cropWidth = sourceWidth;
    let cropHeight = sourceHeight;
    let cropX = 0;
    let cropY = 0;

    if (sourceRatio > targetRatio) {
      cropWidth = Math.round(sourceHeight * targetRatio);
      cropX = Math.round((sourceWidth - cropWidth) / 2);
    } else if (sourceRatio < targetRatio) {
      cropHeight = Math.round(sourceWidth / targetRatio);
      cropY = Math.round((sourceHeight - cropHeight) / 2);
    }

    context.drawImage(
      loadedImage,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      COVER_TARGET_WIDTH,
      COVER_TARGET_HEIGHT
    );

    const compressedBlob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Unable to compress image."));
            return;
          }
          resolve(blob);
        },
        "image/jpeg",
        COVER_JPEG_QUALITY
      );
    });

    const originalName = originalFile.name.replace(/\.[^/.]+$/, "");
    return new File([compressedBlob], `${originalName}-cover.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  };

  const updateLastActive = () => {
    sessionStorage.setItem(SESSION_ACTIVITY_KEY, String(Date.now()));
  };

  const readLastActive = () => {
    const value = Number(sessionStorage.getItem(SESSION_ACTIVITY_KEY) || 0);
    return Number.isFinite(value) ? value : 0;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        if (!user) {
          setAuthUser(null);
          setAuthLoading(false);
          sessionStorage.removeItem(SESSION_ACTIVITY_KEY);
          return;
        }
        const lastActive = readLastActive();
        if (lastActive && Date.now() - lastActive > SESSION_TIMEOUT_MS) {
          setSessionInfo("Session expired after 10 minutes. Please sign in again.");
          signOut(auth);
          return;
        }
        updateLastActive();
        setAuthUser(user);
        setAuthLoading(false);
        setAuthError("");
        setSessionInfo("Logged in");
      },
      (error) => {
        setAuthLoading(false);
        console.log(error);
        setAuthError(getFriendlyError("Unable to verify account right now. Please try again."));
      }
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!authUser) {
      return;
    }

    const markActivity = () => {
      updateLastActive();
    };
    const events = ["click", "keydown", "mousemove", "scroll", "touchstart"];
    events.forEach((eventName) => window.addEventListener(eventName, markActivity, { passive: true }));

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        markActivity();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const sessionInterval = setInterval(() => {
      const lastActive = readLastActive();
      if (!lastActive) {
        return;
      }
      if (Date.now() - lastActive > SESSION_TIMEOUT_MS) {
        setSessionInfo("Session expired after 10 minutes of inactivity.");
        setAuthError("Please sign in again to continue.");
        signOut(auth);
      }
    }, 30000);

    return () => {
      clearInterval(sessionInterval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      events.forEach((eventName) => window.removeEventListener(eventName, markActivity));
    };
  }, [authUser]);

  useEffect(() => {
    async function fetchData() {
      const newsLimit = 1;
      const dbCollection = collection(db, "blogs");
      const q = fquery(dbCollection, orderBy("news_num", "desc"), limit(newsLimit));
      const querySnapshot = await getDocs(q);
      let news_number = 1;
      querySnapshot.forEach((docItem) => {
        const data = docItem.data();
        news_number = Number(data.news_num);
        news_number += 1;
        setNewsNumber(news_number);
      });
    }
    if (!isAuthorized) {
      return;
    }
    fetchData();
  }, [isAuthorized]);

  useEffect(() => {
    try {
      const draft = sessionStorage.getItem(DRAFT_STORAGE_KEY);
      if (!draft) {
        return;
      }
      const parsedDraft = JSON.parse(draft);
      setTitle(parsedDraft.title || "");
      setBody(parsedDraft.body || "");
      setExcerpts(parsedDraft.excerpts || "");
      setImageURL(parsedDraft.imageURL || "");
      setId(parsedDraft.id || "");
      setSelectedValue(parsedDraft.selectedValue || "");
      setSelectedCategory(parsedDraft.selectedCategory || "");
      setCustomCategory(parsedDraft.customCategory || "");
      setSelectedPublishCollection(parsedDraft.selectedPublishCollection || "blogs");
      setConfirmProtectedPublish(Boolean(parsedDraft.confirmProtectedPublish));
      setInlineImageUrls(Array.isArray(parsedDraft.inlineImageUrls) ? parsedDraft.inlineImageUrls : []);
      setShowInlineUploader(Boolean(parsedDraft.showInlineUploader));
    } catch (error) {
      console.log(error);
    }
  }, []);

  useEffect(() => {
    const draft = {
      title,
      body,
      excerpts,
      imageURL,
      id,
      selectedValue,
      selectedCategory,
      customCategory,
      selectedPublishCollection,
      confirmProtectedPublish,
      inlineImageUrls,
      showInlineUploader,
    };
    sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  }, [
    title,
    body,
    excerpts,
    imageURL,
    id,
    selectedValue,
    selectedCategory,
    customCategory,
    selectedPublishCollection,
    confirmProtectedPublish,
    inlineImageUrls,
    showInlineUploader,
  ]);

  const clearFormAfterSubmit = () => {
    setTitle("");
    setBody("");
    setExcerpts("");
    setImageURL("");
    setId("");
    setFile("");
    setPercent(0);
    setInlineFiles([]);
    setInlinePercent(0);
    setInlineImageUrls([]);
    setShowInlineUploader(false);
    setIsInlineUploading(false);
    setSelectedValue("");
    setSelectedCategory("");
    setCustomCategory("");
    setSelectedPublishCollection("blogs");
    setConfirmProtectedPublish(false);
    setNewsNumber((prev) => prev + 1);
    sessionStorage.removeItem(DRAFT_STORAGE_KEY);
    if (coverInputRef.current) {
      coverInputRef.current.value = "";
    }
    if (inlineInputRef.current) {
      inlineInputRef.current.value = "";
    }
  };

  const PushNewsToFirebase = async (e) => {
    e.preventDefault();
    if (!isAuthorized) {
      alert("Please sign in with admin account first.");
      return;
    }
    if (`${title}` === "") {
      alert("please fill title before submit");
      return;
    } else if (id === "") {
      alert("Please Enter News Link: In English Letters");
      return;
    } else if (`${body}` === "") {
      alert("Please Enter Whole News In Body Field");
      return;
    } else if (`${selectedValue}` === "Please Select The Author" || `${selectedValue}` === "") {
      alert("please select the Author");
      return;
    } else if (!resolvedCategory) {
      alert("Please select or enter a news category");
      return;
    } else if (hasProtectedTarget && !confirmProtectedPublish) {
      alert("Please confirm before publishing to protected collection.");
      return;
    } else if (newsNumber === 1000) {
      alert("Please Refresh the page and submit again");
      return;
    }

    const data = {
      Title: `${title}`,
      Time: serverTimestamp(),
      body: `${body}`,
      excerpts: `${excerpts}`,
      posted_by: `${selectedValue}`,
      category: `${resolvedCategory}`,
      id: `${id}`,
      clip: `${clip}`,
      imageSrc: `${imageURL}`,
      news_num: newsNumber,
      views: 80,
    };

    try {
      const targetCollections = [selectedPublishCollection];
      await Promise.all(targetCollections.map((collectionName) => setDoc(doc(db, collectionName, `${title}`), data)));
      alert(`News has been submitted successfully to: ${targetCollections.join(", ")}`);
      clearFormAfterSubmit();
    } catch (error) {
      console.log(error);
      alert(getFriendlyError("Unable to publish news right now. Please try again."));
    }
  };

  const handleUpload = async () => {
    if (!isAuthorized) {
      alert("Please sign in with admin account first.");
      return;
    }
    if (!file) {
      alert("Please select an image first!");
      return;
    }

    let fileToUpload = file;
    try {
      setIsCoverProcessing(true);
      setCoverProcessingInfo("Optimizing cover image (1200x630)...");
      fileToUpload = await optimizeCoverImage(file);
      const sourceSizeKb = Math.max(1, Math.round(file.size / 1024));
      const targetSizeKb = Math.max(1, Math.round(fileToUpload.size / 1024));
      setCoverProcessingInfo(`Optimized ${sourceSizeKb}KB to ${targetSizeKb}KB`);
    } catch (error) {
      console.log(error);
      setCoverProcessingInfo("Could not optimize image. Uploading original file.");
      fileToUpload = file;
    } finally {
      setIsCoverProcessing(false);
    }

    const storageRef = ref(storage, `/News/harsh/${fileToUpload.name}`);
    const uploadTask = uploadBytesResumable(storageRef, fileToUpload);
    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        setPercent(progress);
      },
      (err) => {
        console.log(err);
        alert(getFriendlyError("Image upload failed. Please try again."));
      },
      () => {
        getDownloadURL(uploadTask.snapshot.ref).then((url) => {
          setImageURL(url);
        });
      }
    );
  };

  const uploadInlineImages = async () => {
    if (!isAuthorized) {
      alert("Please sign in with admin account first.");
      return;
    }
    if (isInlineUploading) {
      return;
    }

    if (inlineFiles.length === 0) {
      alert("Please select one or more inline images first!");
      return;
    }

    setIsInlineUploading(true);
    setInlinePercent(0);
    let completed = 0;
    const uploadPromises = inlineFiles.map((currentFile, index) => {
      const fileName = `${Date.now()}-${index}-${currentFile.name}`;
      const storageRef = ref(storage, `/News/harsh/inline/${fileName}`);
      const uploadTask = uploadBytesResumable(storageRef, currentFile);
      return new Promise((resolve, reject) => {
        uploadTask.on(
          "state_changed",
          null,
          (err) => reject(err),
          async () => {
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
            completed += 1;
            setInlinePercent(Math.round((completed / inlineFiles.length) * 100));
            resolve(downloadUrl);
          }
        );
      });
    });

    try {
      const uploadedUrls = await Promise.all(uploadPromises);
      setInlineImageUrls(uploadedUrls);
    } catch (error) {
      console.log(error);
      alert(getFriendlyError("Some images failed to upload. Please try again."));
    } finally {
      setIsInlineUploading(false);
    }
  };

  const copyInlineSnippet = async (url) => {
    const snippet = `#${url}#`;
    try {
      await navigator.clipboard.writeText(snippet);
      alert("Image URL snippet copied.");
    } catch (error) {
      console.log(error);
      alert("Unable to copy. Please copy manually.");
    }
  };

  const handleAdminLogin = async (event) => {
    event.preventDefault();
    setAuthError("");
    if (!loginEmail || !loginPassword) {
      setAuthError("Please enter admin email and password.");
      return;
    }
    setIsSigningIn(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, loginEmail.trim(), loginPassword);
      if (ADMIN_EMAIL && cred.user.email !== ADMIN_EMAIL) {
        setAuthError("This account is not authorized for publishing.");
        await signOut(auth);
      }
      updateLastActive();
      setSessionInfo("Logged in");
      setLoginPassword("");
    } catch (error) {
      console.log(error);
      setAuthError(getFriendlyError("Unable to sign in right now. Please check credentials and try again."));
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleAdminLogout = async () => {
    await signOut(auth);
    setLoginPassword("");
    setSessionInfo("Logged out");
  };

  const translateText = async () => {
    const normalizedInput = translationInput.trim();
    if (!normalizedInput) {
      setTranslationError("Please enter text to translate.");
      setTranslationOutput("");
      return;
    }

    const sourceLanguage = translationDirection === "hi-en" ? "hi" : "en";
    const targetLanguage = translationDirection === "hi-en" ? "en" : "hi";
    setIsTranslating(true);
    setTranslationError("");

    try {
      const endpoint = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLanguage}&tl=${targetLanguage}&dt=t&q=${encodeURIComponent(
        normalizedInput
      )}`;
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error("Translation request failed.");
      }
      const data = await response.json();
      const translatedText = Array.isArray(data?.[0])
        ? data[0].map((part) => part?.[0] || "").join("")
        : "";
      if (!translatedText) {
        throw new Error("No translated text returned.");
      }
      setTranslationOutput(translatedText);
    } catch (error) {
      console.log(error);
      setTranslationError("Unable to translate right now. Please try again.");
    } finally {
      setIsTranslating(false);
    }
  };

  const applyTranslatedText = () => {
    const normalizedOutput = translationOutput.trim();
    if (!normalizedOutput) {
      return;
    }
    setId(formatNewsLink(normalizedOutput));
    setShowTranslateDialog(false);
  };

  if (authLoading) {
    return (
      <div className="upload-news-page">
        <div className="upload-news-card">
          <h2 className="upload-news-title">Checking Admin Session...</h2>
          <p className="upload-news-subtitle">Please wait.</p>
        </div>
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className="upload-news-page">
        <div className="upload-news-card">
          <h2 className="upload-news-title">Admin Login Required</h2>
          <p className="upload-news-subtitle">Sign in to access the news uploader.</p>
          <form className="form" onSubmit={handleAdminLogin}>
            <section className="upload-news-section">
              <div className="form-floating mb-3">
                <input
                  type="email"
                  className="form-control"
                  id="adminEmailInput"
                  placeholder="admin@email.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                />
                <label htmlFor="adminEmailInput">Admin Email</label>
              </div>
              <div className="form-floating mb-3">
                <input
                  type="password"
                  className="form-control"
                  id="adminPasswordInput"
                  placeholder="Password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                />
                <label htmlFor="adminPasswordInput">Password</label>
              </div>
              {authError && <p className="auth-error">{authError}</p>}
              {sessionInfo && <p className="auth-note">{sessionInfo}</p>}
              <button type="submit" className="btn btn-primary btn-lg w-100" disabled={isSigningIn}>
                {isSigningIn ? "Signing in..." : "Sign In"}
              </button>
            </section>
          </form>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="upload-news-page">
        <div className="upload-news-card">
          <h2 className="upload-news-title">Access Denied</h2>
          <p className="upload-news-subtitle">
            Signed in as <strong>{authUser.email}</strong>, but this account is not allowed to publish.
          </p>
          {ADMIN_EMAIL && (
            <p className="auth-note">
              Allowed admin account: <strong>{ADMIN_EMAIL}</strong>
            </p>
          )}
          {sessionInfo && <p className="auth-note">{sessionInfo}</p>}
          <button type="button" className="btn btn-outline-secondary w-100" onClick={handleAdminLogout}>
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="upload-news-page">
      <div className="upload-news-card">
        <div className="upload-header-row">
          <div className="upload-header-text">
            <h2 className="upload-news-title">Upload News</h2>
            <p className="upload-news-subtitle">Fill the news details below.</p>
          </div>
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => {
              setTranslationError("");
              setShowTranslateDialog(true);
            }}
          >
            Open Translator
          </button>
        </div>
        <div className="auth-bar">
          <div className="auth-user-wrap">
            <span className="auth-pill">Logged in</span>
            <span className="auth-user">Signed in: {authUser.email}</span>
          </div>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={handleAdminLogout}>
            Sign Out
          </button>
        </div>
        <div className="upload-status-row">
          <span className={`upload-status ${isCoverUploaded ? "is-done" : "is-pending"}`}>
            Cover image: {isCoverUploaded ? "Uploaded" : "Pending"}
          </span>
          <span className={`upload-status ${inlineImageUrls.length > 0 ? "is-done" : "is-pending"}`}>
            Inline images: {inlineImageUrls.length} uploaded
          </span>
        </div>

        <section className="upload-news-section">
          <h3 className="upload-news-section-title">1. Upload Cover Image</h3>
          <label className="form-label" htmlFor="newsImageInput">
            Select the image
          </label>
            <input
              type="file"
              className="form-control mb-2"
              id="newsImageInput"
              onChange={handleChange}
              accept="image/*"
              ref={coverInputRef}
            />
            <button
              type="button"
              className="btn btn-outline-secondary w-100"
              onClick={handleUpload}
              disabled={isCoverProcessing}
            >
              Upload Image First
            </button>
            {coverProcessingInfo && <p className="upload-hint mt-2">{coverProcessingInfo}</p>}
            <div
              className="progress upload-progress"
              role="progressbar"
            aria-label="Image upload progress"
            aria-valuenow={percent}
            aria-valuemin="0"
            aria-valuemax="100"
          >
            <div className="progress-bar" style={{ width: `${percent}%` }}>
              {percent}%
            </div>
          </div>
        </section>

        <form className="form" onSubmit={PushNewsToFirebase}>
          <section className="upload-news-section">
            <h3 className="upload-news-section-title">2. News Details</h3>
            <div className="form-floating mb-3">
              <input
                onChange={(e) => {
                  setTitle(e.target.value);
                }}
                type="text"
                className="form-control"
                id="newsTitleInput"
                placeholder="Title"
                value={title}
              />
              <label htmlFor="newsTitleInput">Title</label>
            </div>

            <div className="form-floating mb-3">
              <textarea
                onChange={(e) => {
                  setBody(e.target.value);
                }}
                className="form-control upload-textarea"
                placeholder="Body"
                id="newsBodyInput"
                value={body}
              ></textarea>
              <label htmlFor="newsBodyInput">Body, Complete News</label>
            </div>
            <button
              type="button"
              className="btn btn-outline-secondary mb-3"
              onClick={() => {
                if (isInlineUploading) {
                  return;
                }
                setShowInlineUploader((prev) => !prev);
              }}
              disabled={isInlineUploading}
            >
              {showInlineUploader ? "Hide Inline Image Uploader" : "Upload More Images"}
            </button>
            {showInlineUploader && (
              <div className="inline-uploader">
                <p className="upload-hint">
                  Upload all extra images here & get the links
                  <code>#https://...image-url...#</code>
                </p>
                <input
                  type="file"
                  className="form-control mb-2"
                  id="newsInlineImagesInput"
                  onChange={handleInlineFilesChange}
                  accept="image/*"
                  multiple
                  ref={inlineInputRef}
                />
                {inlineFiles.length > 0 && (
                  <p className="upload-hint">{inlineFiles.length} file(s) selected</p>
                )}
                <button
                  type="button"
                  className="btn btn-outline-secondary w-100"
                  onClick={uploadInlineImages}
                  disabled={isInlineUploading}
                >
                  {isInlineUploading ? "Uploading..." : "Upload Selected Images"}
                </button>
                <div
                  className="progress upload-progress"
                  role="progressbar"
                  aria-label="Inline image upload progress"
                  aria-valuenow={inlinePercent}
                  aria-valuemin="0"
                  aria-valuemax="100"
                >
                  <div className="progress-bar" style={{ width: `${inlinePercent}%` }}>
                    {inlinePercent}%
                  </div>
                </div>
                {inlineImageUrls.length > 0 && (
                  <div className="inline-url-list">
                    <p className="inline-url-list-title">Uploaded images (preview + URL snippet):</p>
                    {inlineImageUrls.map((url) => (
                      <div key={url} className="inline-url-card">
                        <div className="inline-url-card-top">
                          <img src={url} alt="inline news" className="inline-url-preview" />
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary inline-copy-btn"
                            onClick={() => copyInlineSnippet(url)}
                            title="Copy URL snippet"
                          >
                            📋 Copy
                          </button>
                        </div>
                        <code className="inline-url-item">#{url}#</code>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="form-floating mb-3">
              <input
                onChange={(e) => {
                  setExcerpts(e.target.value);
                }}
                type="text"
                className="form-control"
                id="newsExcerptInput"
                placeholder="Excerpts"
                value={excerpts}
              />
              <label htmlFor="newsExcerptInput">Excerpts / कुछ अंशः</label>
            </div>

            <label className="form-label" htmlFor="authorSelect">
              Author
            </label>
            <select
              id="authorSelect"
              className="form-select mb-3"
              aria-label="Select author"
              value={selectedValue}
              onChange={handleSelectChange}
            >
              <option value="">Please Select The Author</option>
              <option value="कृष्ण मोहन शर्मा">कृष्ण मोहन शर्मा</option>
              <option value="मुकेश प्रजापति">मुकेश प्रजापति</option>
              <option value="कृष्णा यादव">कृष्णा यादव</option>
            </select>

            <label className="form-label" htmlFor="categorySelect">
              Category
            </label>
            <select
              id="categorySelect"
              className="form-select mb-3"
              aria-label="Select category"
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
            >
              <option value="">Please Select Category</option>
              {CATEGORY_OPTIONS.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            {selectedCategory === "Other" && (
              <div className="form-floating mb-3">
                <input
                  type="text"
                  className="form-control"
                  id="customCategoryInput"
                  placeholder="Enter category"
                  value={customCategory}
                  onChange={(event) => setCustomCategory(event.target.value)}
                />
                <label htmlFor="customCategoryInput">Custom Category</label>
              </div>
            )}

            <label className="form-label">Publish To Collection</label>
            <div className="upload-news-section compact-block mb-3">
              {COLLECTION_TARGETS.map((target) => (
                <div className="form-check mb-2" key={target.key}>
                  <input
                    className="form-check-input"
                    type="radio"
                    name="publishCollection"
                    id={`publish-${target.key}`}
                    checked={selectedPublishCollection === target.key}
                    onChange={() => {
                      setSelectedPublishCollection(target.key);
                      setConfirmProtectedPublish(false);
                    }}
                  />
                  <label className="form-check-label" htmlFor={`publish-${target.key}`}>
                    {target.label}
                    {target.key !== "blogs" ? " (Protected)" : ""}
                  </label>
                </div>
              ))}

              {hasProtectedTarget && (
                <div className="form-check mt-2">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="confirmProtectedPublish"
                    checked={confirmProtectedPublish}
                    onChange={(event) => setConfirmProtectedPublish(event.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="confirmProtectedPublish">
                    I confirm publishing to {selectedPublishCollection}.
                  </label>
                </div>
              )}
            </div>

            <div className="form-floating mb-3">
              <input
                onChange={handleInputChange}
                value={id}
                type="text"
                className="form-control"
                id="newsLinkInput"
                placeholder="news-link"
              />
              <label htmlFor="newsLinkInput">News Link: In English</label>
            </div>
          </section>

          <button type="submit" className="btn btn-primary btn-lg w-100">
            Submit News
          </button>
        </form>
      </div>
      {showTranslateDialog && (
        <div
          className="translate-dialog-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setShowTranslateDialog(false);
            }
          }}
        >
          <div className="translate-dialog" role="dialog" aria-modal="true" aria-labelledby="translateDialogTitle">
            <div className="translate-dialog-header">
              <h3 id="translateDialogTitle" className="translate-dialog-title">
                Translate Text
              </h3>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => setShowTranslateDialog(false)}
              >
                Close
              </button>
            </div>

            <div className="translate-direction-row">
              <button
                type="button"
                className={`btn btn-sm ${
                  translationDirection === "hi-en" ? "btn-primary" : "btn-outline-secondary"
                }`}
                onClick={() => setTranslationDirection("hi-en")}
              >
                Hindi to English
              </button>
              <button
                type="button"
                className={`btn btn-sm ${
                  translationDirection === "en-hi" ? "btn-primary" : "btn-outline-secondary"
                }`}
                onClick={() => setTranslationDirection("en-hi")}
              >
                English to Hindi
              </button>
            </div>

            <label className="form-label mt-2" htmlFor="translationInput">
              Enter text
            </label>
            <textarea
              id="translationInput"
              className="form-control translate-input"
              value={translationInput}
              onChange={(event) => setTranslationInput(event.target.value)}
              placeholder="Type text to translate"
            ></textarea>

            <div className="translate-actions-row">
              <button type="button" className="btn btn-primary" onClick={translateText} disabled={isTranslating}>
                {isTranslating ? "Translating..." : "Translate"}
              </button>
            </div>

            {translationError && <p className="translate-error">{translationError}</p>}

            <label className="form-label mt-2" htmlFor="translationOutput">
              Translated text
            </label>
            <textarea
              id="translationOutput"
              className="form-control translate-output"
              value={translationOutput}
              readOnly
              placeholder="Translation will appear here"
            ></textarea>

            <button
              type="button"
              className="btn btn-outline-secondary w-100 mt-2"
              onClick={applyTranslatedText}
              disabled={!translationOutput.trim()}
            >
              Apply To News Link
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UploadNews;


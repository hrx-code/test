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
  const isCoverUploaded = imageURL !== "";
  const coverInputRef = useRef(null);
  const inlineInputRef = useRef(null);
  const isAuthorized = Boolean(authUser) && (!ADMIN_EMAIL || authUser?.email === ADMIN_EMAIL);

  const handleSelectChange = (event) => {
    setSelectedValue(event.target.value);
  };

  function handleChange(event) {
    setFile(event.target.files[0]);
  }

  function handleInlineFilesChange(event) {
    const files = Array.from(event.target.files || []);
    setInlineFiles(files);
  }

  const handleInputChange = (event) => {
    const input = event.target.value;
    const modifiedInput = input
      .split(/\s+/)
      .map((word) => word.replace(/[^\w\s]/gi, ""))
      .join("-");
    setId(modifiedInput);
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
        setAuthError(error?.message || "Authentication check failed.");
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
      inlineImageUrls,
      showInlineUploader,
    };
    sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  }, [title, body, excerpts, imageURL, id, selectedValue, inlineImageUrls, showInlineUploader]);

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
      id: `${id}`,
      clip: `${clip}`,
      imageSrc: `${imageURL}`,
      news_num: newsNumber,
      views: 80,
    };

    await setDoc(doc(db, "blogs", `${title}`), data).then(() => {
      alert("News has been submitted successfully.");
      clearFormAfterSubmit();
    });
  };

  const handleUpload = () => {
    if (!isAuthorized) {
      alert("Please sign in with admin account first.");
      return;
    }
    if (!file) {
      alert("Please select an image first!");
      return;
    }

    const storageRef = ref(storage, `/News/harsh/${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);
    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        setPercent(progress);
      },
      (err) => console.log(err),
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
      alert("Some images failed to upload. Please try again.");
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
      setAuthError(error?.message || "Unable to sign in. Please try again.");
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleAdminLogout = async () => {
    await signOut(auth);
    setLoginPassword("");
    setSessionInfo("Logged out");
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
        <h2 className="upload-news-title">Upload News</h2>
        <p className="upload-news-subtitle">Fill the news details below.</p>
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
            accept="/image/*"
            ref={coverInputRef}
          />
          <button type="button" className="btn btn-outline-secondary w-100" onClick={handleUpload}>
            Upload Image First
          </button>
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
                  accept="/image/*"
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
              <label htmlFor="newsExcerptInput">Excerpts</label>
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
    </div>
  );
};

export default UploadNews;


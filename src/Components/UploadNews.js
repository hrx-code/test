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
  const GEMINI_PREFERRED_MODELS = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b",
  ];
  const GEMINI_API_KEY = process.env.REACT_APP_GEMINI_API_KEY || "";
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
  const EMERGENCY_COLLECTION = "emergenyc contact";
  const initialEmergencyForm = {
    policeStationLocation: "",
    policeMobileNumber: "",
    hospitalLocation: "",
    hospitalMobileNumber: "",
    ambulanceLocation: "",
    ambulanceMobileNumber: "108",
    fireBrigadeLocation: "",
    fireBrigadeMobileNumber: "101",
    womenHelplineLocation: "",
    womenHelplineMobileNumber: "1091",
    notes: "",
  };
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
  const [activeUploaderTab, setActiveUploaderTab] = useState("news");
  const [isEmergencySubmitting, setIsEmergencySubmitting] = useState(false);
  const [emergencyForm, setEmergencyForm] = useState(initialEmergencyForm);
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
  const [tagsInputText, setTagsInputText] = useState("[]");
  const [isGeneratingTags, setIsGeneratingTags] = useState(false);
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

  const stripImageLinksFromBody = (value) => {
    return String(value || "")
      .replace(/#https?:\/\/\S+\.(?:png|jpe?g|gif|webp|bmp|svg)(?:\?\S*)?#/gi, " ")
      .replace(/!\[[^\]]*]\((https?:\/\/[^)\s]+\.(?:png|jpe?g|gif|webp|bmp|svg)(?:\?\S*)?)\)/gi, " ")
      .replace(/https?:\/\/\S+\.(?:png|jpe?g|gif|webp|bmp|svg)(?:\?\S*)?/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  };

  const getFallbackTags = (cleanBodyText) => {
    const stopWords = new Set([
      "the",
      "and",
      "for",
      "with",
      "this",
      "that",
      "from",
      "have",
      "has",
      "had",
      "are",
      "was",
      "were",
      "will",
      "would",
      "about",
      "into",
      "after",
      "before",
      "under",
      "over",
      "near",
      "very",
      "also",
      "not",
      "you",
      "your",
      "our",
      "their",
      "his",
      "her",
      "its",
      "a",
      "an",
      "in",
      "on",
      "of",
      "to",
      "is",
      "it",
      "as",
      "at",
      "be",
      "or",
      "by",
      "if",
      "we",
      "he",
      "she",
      "they",
      "i",
      "किया",
      "गया",
      "करे",
      "और",
      "है",
      "था",
      "थी",
      "थे",
      "को",
      "से",
      "में",
      "पर",
      "का",
      "की",
      "के",
      "यह",
      "वह",
      "लिए",
    ]);

    const tokens = String(cleanBodyText || "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, " ")
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 2 && !stopWords.has(token));

    const frequency = new Map();
    tokens.forEach((token) => {
      frequency.set(token, (frequency.get(token) || 0) + 1);
    });

    return Array.from(frequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([token]) => token);
  };

  const parseGeminiTagsArray = (rawText) => {
    const normalizedText = String(rawText || "").trim();
    if (!normalizedText) {
      return [];
    }

    try {
      const direct = JSON.parse(normalizedText);
      if (Array.isArray(direct)) {
        return direct
          .map((tag) => String(tag).trim())
          .filter(Boolean)
          .slice(0, 8);
      }
    } catch (error) {
      // Fallback to bracket extraction below.
    }

    const firstBracket = normalizedText.indexOf("[");
    const lastBracket = normalizedText.lastIndexOf("]");
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      const candidate = normalizedText.slice(firstBracket, lastBracket + 1);
      try {
        const parsed = JSON.parse(candidate);
        if (Array.isArray(parsed)) {
          return parsed
            .map((tag) => String(tag).trim())
            .filter(Boolean)
            .slice(0, 8);
        }
      } catch (error) {
        return [];
      }
    }
    return [];
  };

  const parseManualTagsInput = (value) => {
    const normalized = String(value || "").trim();
    if (!normalized) {
      return [];
    }
    try {
      const parsed = JSON.parse(normalized);
      if (Array.isArray(parsed)) {
        return parsed
          .map((tag) => String(tag).trim())
          .filter(Boolean)
          .slice(0, 8);
      }
    } catch (error) {
      // Accept comma-separated fallback.
    }
    return normalized
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 8);
  };

  const hasHindiScript = (value) => /[\u0900-\u097F]/.test(String(value || ""));

  const normalizeTags = (tags) => {
    return Array.from(
      new Set(
        (Array.isArray(tags) ? tags : [])
          .map((tag) => String(tag).trim())
          .filter(Boolean)
      )
    ).slice(0, 8);
  };

  const getHindiOnlyTags = (tags) => {
    return normalizeTags(tags).filter((tag) => hasHindiScript(tag));
  };

  const isMostlyHindiTags = (tags) => {
    const normalized = normalizeTags(tags);
    if (normalized.length === 0) {
      return false;
    }
    const hindiCount = normalized.filter((tag) => hasHindiScript(tag)).length;
    return hindiCount >= Math.ceil(normalized.length * 0.7);
  };

  const resolveGeminiModelCandidates = async () => {
    if (!GEMINI_API_KEY) {
      return GEMINI_PREFERRED_MODELS;
    }

    try {
      const listEndpoint = `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`;
      const response = await fetch(listEndpoint);
      if (!response.ok) {
        return GEMINI_PREFERRED_MODELS;
      }

      const payload = await response.json();
      const availableGenerateContentModels = (payload?.models || [])
        .filter((model) => (model?.supportedGenerationMethods || []).includes("generateContent"))
        .map((model) => String(model?.name || "").replace(/^models\//, ""))
        .filter(Boolean);

      if (availableGenerateContentModels.length === 0) {
        return GEMINI_PREFERRED_MODELS;
      }

      const preferredAvailable = GEMINI_PREFERRED_MODELS.filter((modelName) =>
        availableGenerateContentModels.includes(modelName)
      );
      const remainingAvailable = availableGenerateContentModels.filter(
        (modelName) => !preferredAvailable.includes(modelName)
      );
      return [...preferredAvailable, ...remainingAvailable];
    } catch (error) {
      console.log(error);
      return GEMINI_PREFERRED_MODELS;
    }
  };

  const callGeminiWithModelFallback = async (promptText, temperature = 0.2) => {
    const modelCandidates = await resolveGeminiModelCandidates();
    let lastError = null;

    for (const modelName of modelCandidates) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`;
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: promptText }],
              },
            ],
            generationConfig: {
              responseMimeType: "application/json",
              temperature,
            },
          }),
        });

        if (!response.ok) {
          const errorPayload = await response.text();
          throw new Error(`[${modelName}] ${response.status}: ${errorPayload}`);
        }

        const payload = await response.json();
        const mergedText = (payload?.candidates || [])
          .flatMap((candidate) => candidate?.content?.parts || [])
          .map((part) => part?.text || "")
          .join("\n");

        if (!mergedText.trim()) {
          throw new Error(`[${modelName}] Empty response from Gemini.`);
        }
        return mergedText;
      } catch (error) {
        lastError = error;
        console.log(error);
      }
    }

    throw lastError || new Error("All Gemini model calls failed.");
  };

  const getGeminiTags = async (cleanBodyText) => {
    if (!cleanBodyText.trim()) {
      return [];
    }
    if (!GEMINI_API_KEY) {
      return [];
    }

    const prompt = [
      "You are a keyword extractor for local news.",
      "Extract 5 to 8 descriptive keywords from the given news body.",
      "Keywords must be in Hindi, written in Devanagari script only.",
      "Use short keyword phrases, not full sentences.",
      "Return only a valid JSON array of strings.",
      "No markdown, no explanation.",
      `News body: ${cleanBodyText}`,
    ].join("\n");
    const mergedText = await callGeminiWithModelFallback(prompt, 0.2);
    const parsedTags = parseGeminiTagsArray(mergedText);
    const uniqueTags = normalizeTags(parsedTags);
    if (uniqueTags.length === 0) {
      throw new Error("Gemini returned empty or unparsable tags.");
    }
    return uniqueTags;
  };

  const convertTagsToHindi = async (tags) => {
    const normalizedTags = normalizeTags(tags);
    if (normalizedTags.length === 0 || !GEMINI_API_KEY) {
      return normalizedTags;
    }

    const prompt = [
      "Convert the following keyword array into Hindi Devanagari tags.",
      "Keep meaning equivalent and concise.",
      "Return only valid JSON array of strings.",
      `Tags: ${JSON.stringify(normalizedTags)}`,
    ].join("\n");
    const mergedText = await callGeminiWithModelFallback(prompt, 0.1);
    return normalizeTags(parseGeminiTagsArray(mergedText));
  };

  const handleGenerateTagsClick = async () => {
    const bodyWithoutImageLinks = stripImageLinksFromBody(body);
    if (!bodyWithoutImageLinks) {
      alert("Please enter body content first.");
      return;
    }
    setIsGeneratingTags(true);
    try {
      const generatedByGemini = await getGeminiTags(bodyWithoutImageLinks);
      let finalTags = generatedByGemini;
      if (!isMostlyHindiTags(finalTags)) {
        try {
          const converted = await convertTagsToHindi(finalTags);
          if (converted.length > 0) {
            finalTags = converted;
          }
        } catch (error) {
          console.log(error);
        }
      }
      setTagsInputText(JSON.stringify(finalTags));
      console.log("Generated tags (Gemini Hindi preferred):", finalTags);
    } catch (error) {
      console.log(error);
      const fallbackTags = getHindiOnlyTags(getFallbackTags(bodyWithoutImageLinks));
      setTagsInputText(JSON.stringify(fallbackTags));
      console.log("Generated tags (Fallback):", fallbackTags);
      alert("Gemini tag generation failed. Fallback tags generated and logged in console.");
    } finally {
      setIsGeneratingTags(false);
    }
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
    setTagsInputText("[]");
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

    const manualTags = parseManualTagsInput(tagsInputText);
    let generatedTags = manualTags;
    if (generatedTags.length === 0) {
      const bodyWithoutImageLinks = stripImageLinksFromBody(body);
      try {
        generatedTags = await getGeminiTags(bodyWithoutImageLinks);
        if (!isMostlyHindiTags(generatedTags)) {
          try {
            const converted = await convertTagsToHindi(generatedTags);
            if (converted.length > 0) {
              generatedTags = converted;
            }
          } catch (error) {
            console.log(error);
          }
        }
      } catch (error) {
        console.log(error);
        generatedTags = getFallbackTags(bodyWithoutImageLinks);
      }
    }
    generatedTags = normalizeTags(generatedTags);

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
      tags: generatedTags,
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

  const handleEmergencyFieldChange = (field, value) => {
    setEmergencyForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const uploadEmergencyContacts = async (event) => {
    event.preventDefault();
    if (!isAuthorized) {
      alert("Please sign in with admin account first.");
      return;
    }

    if (
      !emergencyForm.policeStationLocation.trim() ||
      !emergencyForm.policeMobileNumber.trim() ||
      !emergencyForm.hospitalLocation.trim() ||
      !emergencyForm.hospitalMobileNumber.trim()
    ) {
      alert("Please fill police and hospital location + number.");
      return;
    }

    setIsEmergencySubmitting(true);
    try {
      const emergencyDocRef = doc(collection(db, EMERGENCY_COLLECTION));
      await setDoc(emergencyDocRef, {
        policeStation: {
          location: emergencyForm.policeStationLocation.trim(),
          mobileNumber: emergencyForm.policeMobileNumber.trim(),
        },
        hospital: {
          location: emergencyForm.hospitalLocation.trim(),
          mobileNumber: emergencyForm.hospitalMobileNumber.trim(),
        },
        ambulance: {
          location: emergencyForm.ambulanceLocation.trim(),
          mobileNumber: emergencyForm.ambulanceMobileNumber.trim(),
        },
        fireBrigade: {
          location: emergencyForm.fireBrigadeLocation.trim(),
          mobileNumber: emergencyForm.fireBrigadeMobileNumber.trim(),
        },
        womenHelpline: {
          location: emergencyForm.womenHelplineLocation.trim(),
          mobileNumber: emergencyForm.womenHelplineMobileNumber.trim(),
        },
        notes: emergencyForm.notes.trim(),
        createdAt: serverTimestamp(),
      });
      alert("Emergency contacts uploaded successfully.");
      setEmergencyForm(initialEmergencyForm);
    } catch (error) {
      console.log(error);
      alert(getFriendlyError("Unable to upload emergency contacts right now. Please try again."));
    } finally {
      setIsEmergencySubmitting(false);
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
          <div className="d-flex gap-2">
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => {
                setActiveUploaderTab("emergency");
              }}
            >
              Emergency Contact
            </button>
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
        {activeUploaderTab === "news" && (
          <>
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
            <div className="d-flex align-items-center gap-2 mb-2">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={handleGenerateTagsClick}
                disabled={isGeneratingTags}
              >
                {isGeneratingTags ? "Generating..." : "Generate Tags"}
              </button>
              <span className="upload-hint mb-0">Generates 5-8 tags and logs them in console.</span>
            </div>
            <div className="form-floating mb-3">
              <input
                type="text"
                className="form-control"
                id="newsTagsInput"
                placeholder='["tag1","tag2"]'
                value={tagsInputText}
                onChange={(e) => setTagsInputText(e.target.value)}
              />
              <label htmlFor="newsTagsInput">Tags Array (Editable)</label>
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
          </>
        )}

        {activeUploaderTab === "emergency" && (
          <form className="form" onSubmit={uploadEmergencyContacts}>
            <section className="upload-news-section">
              <h3 className="upload-news-section-title">Emergency Contact Form</h3>
              <p className="upload-hint">Fill service location and mobile numbers, then submit.</p>

              <div className="form-floating mb-3">
                <input
                  type="text"
                  className="form-control"
                  id="policeStationLocationInput"
                  placeholder="Police Station Location"
                  value={emergencyForm.policeStationLocation}
                  onChange={(event) => handleEmergencyFieldChange("policeStationLocation", event.target.value)}
                />
                <label htmlFor="policeStationLocationInput">Police Station Location</label>
              </div>
              <div className="form-floating mb-3">
                <input
                  type="text"
                  className="form-control"
                  id="policeMobileInput"
                  placeholder="Police Mobile Number"
                  value={emergencyForm.policeMobileNumber}
                  onChange={(event) => handleEmergencyFieldChange("policeMobileNumber", event.target.value)}
                />
                <label htmlFor="policeMobileInput">Police Mobile Number</label>
              </div>

              <div className="form-floating mb-3">
                <input
                  type="text"
                  className="form-control"
                  id="hospitalLocationInput"
                  placeholder="Hospital Location"
                  value={emergencyForm.hospitalLocation}
                  onChange={(event) => handleEmergencyFieldChange("hospitalLocation", event.target.value)}
                />
                <label htmlFor="hospitalLocationInput">Hospital Location</label>
              </div>
              <div className="form-floating mb-3">
                <input
                  type="text"
                  className="form-control"
                  id="hospitalMobileInput"
                  placeholder="Hospital Mobile Number"
                  value={emergencyForm.hospitalMobileNumber}
                  onChange={(event) => handleEmergencyFieldChange("hospitalMobileNumber", event.target.value)}
                />
                <label htmlFor="hospitalMobileInput">Hospital Mobile Number</label>
              </div>

              <div className="form-floating mb-3">
                <input
                  type="text"
                  className="form-control"
                  id="ambulanceLocationInput"
                  placeholder="Ambulance Location"
                  value={emergencyForm.ambulanceLocation}
                  onChange={(event) => handleEmergencyFieldChange("ambulanceLocation", event.target.value)}
                />
                <label htmlFor="ambulanceLocationInput">Ambulance Location</label>
              </div>
              <div className="form-floating mb-3">
                <input
                  type="text"
                  className="form-control"
                  id="ambulanceMobileInput"
                  placeholder="Ambulance Number"
                  value={emergencyForm.ambulanceMobileNumber}
                  onChange={(event) => handleEmergencyFieldChange("ambulanceMobileNumber", event.target.value)}
                />
                <label htmlFor="ambulanceMobileInput">Ambulance Number</label>
              </div>

              <div className="form-floating mb-3">
                <input
                  type="text"
                  className="form-control"
                  id="fireLocationInput"
                  placeholder="Fire Brigade Location"
                  value={emergencyForm.fireBrigadeLocation}
                  onChange={(event) => handleEmergencyFieldChange("fireBrigadeLocation", event.target.value)}
                />
                <label htmlFor="fireLocationInput">Fire Brigade Location</label>
              </div>
              <div className="form-floating mb-3">
                <input
                  type="text"
                  className="form-control"
                  id="fireMobileInput"
                  placeholder="Fire Brigade Number"
                  value={emergencyForm.fireBrigadeMobileNumber}
                  onChange={(event) => handleEmergencyFieldChange("fireBrigadeMobileNumber", event.target.value)}
                />
                <label htmlFor="fireMobileInput">Fire Brigade Number</label>
              </div>

              <div className="form-floating mb-3">
                <input
                  type="text"
                  className="form-control"
                  id="womenHelplineLocationInput"
                  placeholder="Women Helpline Location"
                  value={emergencyForm.womenHelplineLocation}
                  onChange={(event) => handleEmergencyFieldChange("womenHelplineLocation", event.target.value)}
                />
                <label htmlFor="womenHelplineLocationInput">Women Helpline Location</label>
              </div>
              <div className="form-floating mb-3">
                <input
                  type="text"
                  className="form-control"
                  id="womenHelplineMobileInput"
                  placeholder="Women Helpline Number"
                  value={emergencyForm.womenHelplineMobileNumber}
                  onChange={(event) => handleEmergencyFieldChange("womenHelplineMobileNumber", event.target.value)}
                />
                <label htmlFor="womenHelplineMobileInput">Women Helpline Number</label>
              </div>

              <div className="form-floating mb-3">
                <textarea
                  className="form-control upload-textarea"
                  id="emergencyNotesInput"
                  placeholder="Notes"
                  value={emergencyForm.notes}
                  onChange={(event) => handleEmergencyFieldChange("notes", event.target.value)}
                ></textarea>
                <label htmlFor="emergencyNotesInput">Notes</label>
              </div>
            </section>

            <div className="d-flex gap-2">
              <button
                type="button"
                className="btn btn-outline-secondary w-100"
                onClick={() => setActiveUploaderTab("news")}
              >
                Back To News Form
              </button>
              <button type="submit" className="btn btn-primary btn-lg w-100" disabled={isEmergencySubmitting}>
                {isEmergencySubmitting ? "Submitting..." : "Submit Emergency Contacts"}
              </button>
            </div>
          </form>
        )}
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


import {React,useState,useEffect} from 'react'
import {setDoc,doc,dbForUploadNews as db,storage,listAll,serverTimestamp,collection,getDocs,orderBy,query as fquery,limit } from '../firebase.config'
import "../CSS/UploadNews.css"
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

const UploadNews = () => {

  const [time, setTime] = useState();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("")
  const [excerpts, setExcerpts] = useState("");
  const [clip,setClip] = useState("");
  const [posted_by, setPosted_by] = useState("");
  const [imageURL, setImageURL] = useState("");
  const [id, setId] = useState("")
  const [file, setFile] = useState("");
  const [views, setViews] = useState(0)
  const [newsNumber, setNewsNumber] = useState(1000)
    // progress
    const [percent, setPercent] = useState(0);

    const [selectedValue, setSelectedValue] = useState('');

    const handleSelectChange = (event) => {
      setSelectedValue(event.target.value);
    };
  
    // Handle file upload event and update state
    function handleChange(event) {
        setFile(event.target.files[0]);
    }

  const TimeHandler=(e)=>{
    setTime(e.target.value)
  }
  const TitleHandler=(e)=>{
    setTitle(e.target.value);
  }
  const BodyHandler=(e)=>{
    setBody(e.target.value)
  }
  const ExcerptsHandler=(e)=>{
    setExcerpts(e.target.value);
  }
  const PostedByHandler=(e)=>{
    setPosted_by(e.target.value);
  }
  const handleInputChange = (event) => {
    const input = event.target.value;
    const modifiedInput = input
      .split(/\s+/) // Split the input by whitespace
      .map((word) => word.replace(/[^\w\s]/gi, "")) // Remove special characters from each word
      .join("-"); // Join the modified words with hyphens
    // comment added unnecessary.
    setId(modifiedInput);
  };
 
  useEffect(() => {
    async function fetchData(){
    const newsLimit =1;
    const dbCollection = collection(db, 'blogs');
    let  q=fquery(dbCollection,orderBy('news_num','desc'),limit(newsLimit));
    const querySnapshot=await getDocs(q);
    let news_number=1;
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      news_number=Number(data.news_num);
      news_number+=1;
      console.log("latest news_number"+news_number);
      setNewsNumber(news_number);
    })
  }
    fetchData();
  }, [])
  

  const PushNewsToFirebase=async(e)=>{
    e.preventDefault();
    let s=id;
    console.log(s+" pre");
    if(`${title}`===""){
      alert('please fill title before submit')
      return;
    } else if(s===""){
      alert("Please Enter News Link: In English Letters")
      return;
    } else if(`${body}`===""){
      alert("Please Enter Whole News In Body Field")
      return;
    }  else if(`${selectedValue}`==='Please Select The Author'){
      alert("please select the Author");
      return;
    } else if(newsNumber===1000){
      alert("Please Refresh the page and submit again");
      return;
    }
    /// To increment the news counter automatically.
    // remove , . '
    const date=new Date();
    setTime(date); const testNewsNumberValue={newsNumber};
    // console.log("time logged"+{time});
    const data={
      Title:`${title}`,
      Time:serverTimestamp(),
      body:`${body}`,
      excerpts:`${excerpts}`,
      posted_by:`${selectedValue}`,
      id:`${id}`,
      clip:`${clip}`,
      imageSrc:`${imageURL}`,
      news_num :newsNumber,
      views:80,
    }
    const result =await setDoc(doc(db, "blogs",`${title}`), 
      data
    ).then(( )=>{alert("News Uploaded Successfully!! "+{testNewsNumberValue})});
    // console.log("result after submit get clicked: "+result);
  }

const handleUpload = () => {
    if (!file) {
      alert("Please select an image first!");
    }
    console.log(file.name)
    const storageRef = ref(storage, `/News/harsh/${file.name}`);
        // progress can be paused and resumed. It also exposes progress updates.
      // Receives the storage reference and the file to upload.
    const uploadTask = uploadBytesResumable(storageRef, file);
    uploadTask.on(
          "state_changed",
            (snapshot) => {
              const percent = Math.round(
                  (snapshot.bytesTransferred / snapshot.totalBytes) * 100
            );
              // update progress
              setPercent(percent);
          },
          (err) => console.log(err),
          () => {
              // download url
              getDownloadURL(uploadTask.snapshot.ref).then((url) => {
                  // console.log(url);
                  setImageURL(url);
            });
        }
    );
    
};


  return (
    <div className='d-flex flex-column align-items-center justify-content-center'>
        <h2>Please Give Details Of Your News</h2>
        <div>
            {/* <input type="file" onChange={handleChange} accept="/image/*" /> */}
            <div>
              <label className="form-label" >Select The Image</label>
              <input type="file" className="form-control mb-2" id="customFile" onChange={handleChange} accept="/image/*"/>
            </div>
            {/* <button onClick={handleUpload}>Upload Image First</button> */}
            <button type="button" className="btn btn-secondary btn-lg btn-block" onClick={handleUpload}>First, Upload Image</button>
            <p>{`${percent}`} % done</p>
        </div>
        <form className='form' onSubmit={PushNewsToFirebase}>
            <div className="form-floating mb-3">
              <input onChange={e=>{setTitle(e.target.value)}} type="text" className="form-control" id="floatingInput" placeholder="guthanisiwan.com"/>
              <label >Title</label>
            </div>
            <div className="form-floating mb-3">
              <textarea onChange={e=>{setBody(e.target.value)}} className="form-control" placeholder="Leave a comment here" id="floatingTextarea"></textarea>
              <label >Body,Complete News</label>
            </div>

          <div className="form-floating mb-3">
            <input onChange={e=>{setExcerpts(e.target.value)}} type="text" className="form-control" id="floatingInput" placeholder="guthanisiwan.com"/>
            <label >Excerpts</label>
          </div>

          {/* <div className="form-floating mb-3">
            <input onChange={e=>{setNewsNumber(e.target.value)}} type="text" className="form-control" id="floatingInput" placeholder="guthanisiwan.com"/>
            <label >News Number</label>
          </div> */}

          {/* <div className="form-floating mb-3">
            <input onChange={e=>{setPosted_by(e.target.value)}} type="text" className="form-control" id="floatingInput" placeholder="guthanisiwan.com"/>
            <label >Posted By</label>
          </div> */}
          <div>
            <select className="form-select mb-3" aria-label="Default select example"
            value={selectedValue} onChange={handleSelectChange}>
              <option selected value=''>Please Select The Author</option>
              <option value='कृष्ण मोहन शर्मा'>कृष्ण मोहन शर्मा</option>
              <option value='मुकेश प्रजापति'>मुकेश प्रजापति</option>
              <option value='कृष्णा यादव'>कृष्णा यादव</option>
            </select>
          </div>

          <div className="form-floating mb-3">
            <input onChange={handleInputChange} value={id} type="text" className="form-control" id="floatingInput" placeholder="guthanisiwan.com"/>
            <label >News Link: In English</label>
          </div>
          <button type="button" className="btn btn-primary btn-lg btn-block" onClick={PushNewsToFirebase}>Submit News</button>
        </form>
    </div>
   
  )
}

export default UploadNews
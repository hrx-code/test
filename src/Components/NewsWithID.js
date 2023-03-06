import React from 'react'
import { useState,useEffect } from 'react'
import { useParams } from 'react-router-dom'
import {db1 as db} from '../firebase.config'
import { useLocation } from 'react-router-dom'
import { collection, getDocs  } from "firebase/firestore";
import { RWebShare } from "react-web-share";
import {FacebookIcon,FacebookShareButton,WhatsappShareButton,WhatsappIcon} from 'react-share'
import  '../CSS/DetailedNewsStyle.css'

const NewsWithID = () => {
  
    // const location = useLocation()
    // var Body="",Title="",excerpts="",posted_by="",date="";

    const [Body, setBody] = useState("");
    const [Title, setTitle] = useState("");
    const [excerpts, setExcerpts] = useState('');
    const [posted_by, setPosted_by] = useState("");
    const [date, setDate] = useState("");
    const [imgURL, setImgURL] = useState("")

    // if(location.state!=null){
    //    setBody(location.state.Body);
    //    setTitle(location.state.Title);
    // }
    
    const params=useParams();
    const userId=params.id;
    // console.log("URL userID "+userId)

    const [blog,setBlog]=useState([{}])

    const fetchBlog=async()=>{
      const dbCollection = collection(db, 'blogs');
      const datasnap = await getDocs(dbCollection);
      // console.log("data snap docs"+datasnap.docs);
      const data = datasnap.docs.map(doc => doc.data());
      // console.log(data);
      data.forEach(item=>{
      // console.log("item time "+item.Time+"\n")
      // console.log("item body: "+item.body+"\n")
        if(item.id==userId){
            setTitle(item.Title)
            setBody(item.body);
            setExcerpts(item.excerpts);
            setPosted_by(item.posted_by);
            // setDate(item.Time.toDateString());
            setImgURL(item.imageSrc)
            // console.log("imageURL "+imgURL);
        }
      })

    }
    useEffect(() => {
      fetchBlog();
    }, [])

    const handleShareButton = () => {
      // Check if navigator.share is supported by the browser
      if (navigator.share) {
        console.log("Congrats! Your browser supports Web Share API");
        navigator
          .share({
            url: `https://guthanisiwan.com`,
            title:'trying to add webshare api'
          })
          .then(() => {
            console.log("Sharing successfull");
          })
          .catch(() => {
            console.log("Sharing failed");
          });
      } else {
        console.log("Sorry! Your browser does not support Web Share API");
      }
    };

  return (
    <div className='complete-news'>
          <div id="detailedNews" className='detailedNews'>
              <div id="Title">
                  <h2><p className="text-justify float-left fw-bold">{Title}</p></h2>
              </div>
              <div id="news-image">
                  {/* <p>image ll be loaded soon</p> */}
                  <img src={imgURL} className='img-fluid media'></img>
              </div>
              <div id="author-date">
                {
                      posted_by!=="" &&
                        <p className="text-justify">{posted_by},{date}
                          {/* <svg onClick={shareClickHandler} xmlns="http://www.w3.org/2000/svg" width="20" height="16" fill="currentColor" class="bi bi-share" viewBox="0 0 16 16">
                             <path d="M13.5 1a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM11 2.5a2.5 2.5 0 1 1 .603 1.628l-6.718 3.12a2.499 2.499 0 0 1 0 1.504l6.718 3.12a2.5 2.5 0 1 1-.488.876l-6.718-3.12a2.5 2.5 0 1 1 0-3.256l6.718-3.12A2.5 2.5 0 0 1 11 2.5zm-8.5 4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm11 5.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/>
                          </svg> */}
                        </p>
                        
                }
                  
              </div>
              <div style={{width:'3rem', height:'3rem'}}>
                <div className='share-btn-whatsapp'>
                  <WhatsappShareButton 
                    title={`${Title}\n`}
                    url={`guthanisiwan.com/#/news/${userId}`}
                  >
                    <WhatsappIcon className='btn-whatsapp'></WhatsappIcon>
                  </WhatsappShareButton>
                </div>

                {/* <div>
                  <button
                      onClick={handleShareButton}
                      className="share-button"
                      type="button"
                      title="Share this article"
                    >
                    Share
                  </button>
                </div> */}
                <div>
                    <RWebShare
                          data={{
                            text: "Like humans, flamingos make friends for life",
                            url: "https://guthanisiwan.com",
                            title: "Flamingos",
                          }}
                          onClick={() => console.log("shared successfully!")}
                        >
                    <button>RWebShare 🔗</button>
                  </RWebShare>
                </div>

              </div>
              
              <div id="body">
                {
                  
                    Body!="" &&
                     Body.split('#').map(text=>{
                      return(
                        <>
                          <p className='text-break,text-left text-justify'>{text}</p>
                          <br></br>
                        </>
                      )
                     })
                }
                  {/* <p>{Body}</p> */}
              </div>
          </div>
    </div>  
  )
}
export default NewsWithID

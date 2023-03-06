import React from 'react'
import {useEffect,useState} from 'react'
// import { getStorage, ref, listAll } from "firebase/storage";
import { storage1 as storage,listAll,ref ,getDownloadURL} from '../firebase.config';

const RetrieveImg = () => {
        const [files, setFiles] = useState();
        const [urls, setURLs] = useState([])
       const retriever=async()=>{
            const listRef = ref(storage, 'News/harsh');

            // Find all the prefixes and items.
            // listAll(listRef)
            // .then((res) => {
            //     // res.prefixes.forEach((folderRef) => {
            //     // // All the prefixes under listRef.
            //     // // You may call listAll() recursively on them.
            //     // });
            //     res.items.forEach((itemRef) => {
            //     // All the items under listRef.
            //         console.log(itemRef);
            //     });
            // }).catch((error) => {
            //     // Uh-oh, an error occurred!
            // });

            // Harsh
            const result=await listAll(listRef);
            // console.log(result);
             result.items.map((imageRef) => getDownloadURL(imageRef)
                                                .then(url=>{
                                                    setURLs([...urls,url])
                                                    console.log("then url "+url);
                                                }));
                                                console.log({urls});
            urls.map(url=>{
                console.log({url});
            })
        }
        useEffect(() => {
            retriever();
        }, []);
        
        return (
            <div>RetrieveImg Page
                 {/* {  urls.map(url=>{
                    return(
                        <>
                             <img src={url} width="300px" height="300px"/>
                             <br></br>
                        </>
                        
                    )
                     
                    })
                } */}
            </div>
        )
}

export default RetrieveImg;
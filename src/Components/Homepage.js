import React from 'react'
import {useState,useEffect} from 'react'
// import {collection,getDocs} from  "firebase/firestore"
import {colRef, collection,db,getDocs} from '../firebase.config'

const Homepage = () => {
    // const [Blogs, setBlogs] = useState('')

    // const fetchBlogs=async()=>{
    //   // const querySnapshot = await getDocs(collection(colRef, "blogs"));
    //   // querySnapshot.forEach((doc) => {
    //   //   // doc.data() is never undefined for query doc snapshots
    //   //   console.log(doc);
    //   // });

    //     const citiesCol = collection(db, 'blogs');
    //     const citySnapshot = await getDocs(citiesCol);
    //     const cityList = citySnapshot.docs.map(doc => doc.data());
    //     console.log(cityList);
      

    // }
    // useEffect(() => {
    //     setBlogs([])
    //     fetchBlogs();
    // }, [])
  return (
    <div>
        This is homepage, where retrieved data ll be shown. Thanks,
    </div>
  )
}

export default Homepage
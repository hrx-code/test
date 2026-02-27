import logo from './logo.svg';
import './App.css';
import Homepage from './Components/Homepage';
import ImgUploader from './Components/ImgUploader';
import RetrieveImg from './Components/RetrieveImg';
import About from './Components/About';
import NewsWithID from './Components/NewsWithID';
import UploadNews from './Components/UploadNews';
import Articles from './Components/Articles'
// import UploadNews from './Components/UploadNews';
import {HashRouter, BrowserRouter, Routes, Route } from "react-router-dom";
import Preview from './Components/Preview';

function App() {
  return (
    <div className="App">
      <HashRouter>      
        <Routes>
          <Route path="/">This is / page. I mean root page but in another component</Route>
          <Route path="/home" element={<Homepage></Homepage>}></Route>
          <Route path="/about" element={<About></About>}></Route>
          <Route path="/News/:id" element={<NewsWithID></NewsWithID>}></Route>
          <Route path="/uploadNews" element={<UploadNews></UploadNews>}></Route>
          <Route path="/imageupload" element={<ImgUploader></ImgUploader>}></Route>
          <Route path="/imagedownload" element={<RetrieveImg></RetrieveImg>}></Route>
          <Route path="/articles" element={<Articles></Articles>}></Route>
        </Routes>
      </HashRouter>
    </div>
  );
}

export default App;

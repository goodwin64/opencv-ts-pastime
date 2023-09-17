import React from "react";
import cv from "@techstark/opencv-js";
import "./style.css";

window.cv = cv;

const charToImageUrl = {
  1: "https://i.imgur.com/Mcd6Bd6.png",
  2: "https://i.imgur.com/NvzJWJ9.png",
  3: "https://i.imgur.com/sbrgBIu.png",
  4: "https://i.imgur.com/CLE01CM.png",
  5: "https://i.imgur.com/Yn9RZ9B.png",
  6: "https://i.imgur.com/czsFuzu.png",
  7: "https://i.imgur.com/mGIXtm2.png",
  8: "https://i.imgur.com/48jj7oi.png",
  9: "https://i.imgur.com/u2qjTHi.png",
  a: "https://i.imgur.com/zFZSq8h.png",
  c: "https://i.imgur.com/sKs0EC1.png",
  d: "https://i.imgur.com/wp14bEi.png",
  e: "https://i.imgur.com/PYMCVqS.png",
  g: "https://i.imgur.com/3PZbU3u.png",
  h: "https://i.imgur.com/jBexQby.png",
  k: "https://i.imgur.com/UyNsjRI.png",
  n: "https://i.imgur.com/xj9o2mD.png",
  p: "https://i.imgur.com/6RR9Dz9.png",
  q: "https://i.imgur.com/QgNM842.png",
  s: "https://i.imgur.com/EJpiDbL.png",
  u: "https://i.imgur.com/kxTIG6s.png",
  v: "https://i.imgur.com/FdLk1Xe.png",
  x: "https://i.imgur.com/c700HSh.png",
  y: "https://i.imgur.com/eLUpSd6.png",
  z: "https://i.imgur.com/zti5smS.png",
};
const availableChars = Object.keys(charToImageUrl);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class TestPage extends React.Component {
  constructor(props) {
    super(props);
    this.inputImgRef = React.createRef();
    this.resultImageRef = React.createRef();
    this.state = {
      // if we want to load by URL from the beginning - specify the URL here;
      // otherwise, pick an image using file input
      // captcha example: https://i.imgur.com/a02Kkaq.jpg
      imgUrl: "https://i.imgur.com/rEppR08.jpg",
    };
    this.openCvLoaded = false;
  }

  async waitForOpenCvLoaded() {
    if (this.openCvLoaded) {
      return Promise.resolve(); // Already loaded, resolve immediately
    }

    return new Promise((resolve) => {
      cv["onRuntimeInitialized"] = () => {
        this.openCvLoaded = true;
        return resolve();
      };
    });
  }

  // clear existing images when processing new
  clearExistingImages() {
    const container = document.querySelector(".images-container");
    container.innerHTML = "";
  }

  /////////////////////////////////////////
  //
  // process image with opencv.js
  //
  /////////////////////////////////////////
  async processImage(imgSrc) {
    await this.waitForOpenCvLoaded();
    this.clearExistingImages();
    const imgSource = cv.imread(imgSrc);

    // Convert the image to grayscale
    let gray = new cv.Mat();
    cv.cvtColor(imgSource, gray, cv.COLOR_BGR2GRAY);
    this.showImage("gray", gray);

    let flt = new cv.Mat();
    cv.adaptiveThreshold(
      gray,
      flt,
      100,
      cv.ADAPTIVE_THRESH_MEAN_C,
      cv.THRESH_BINARY,
      13,
      16
    );
    this.showImage("flt", flt);

    let kernel3 = cv.Mat.ones(3, 3, cv.CV_8U);
    let opn = new cv.Mat();
    cv.morphologyEx(flt, opn, cv.MORPH_OPEN, kernel3);
    this.showImage("opn", opn);

    let cls = new cv.Mat();
    cv.morphologyEx(opn, cls, cv.MORPH_CLOSE, kernel3);
    this.showImage("cls", cls);

    let curves = new cv.Mat();
    cv.bitwise_or(cls, gray, curves);
    this.showImage("curves", curves);

    let curvesMask = new cv.Mat();
    cv.threshold(curves, curvesMask, 200, 255, cv.THRESH_BINARY);
    // cv.erode(
    //   curvesMask,
    //   curvesMask,
    //   cv.Mat.ones(3, 3, cv.CV_8U),
    //   {
    //     x: -1,
    //     y: -1,
    //   },
    //   1,
    //   cv.BORDER_CONSTANT
    // );
    this.showImage("curvesMask", curvesMask);

    // Invert the curvesMask to keep the regions you want to remove
    let invertedCurvesMask = new cv.Mat();
    cv.bitwise_not(curvesMask, invertedCurvesMask);
    this.showImage("invertedMask", invertedCurvesMask);

    // Apply the inverted curvesMask to the source image to remove unwanted regions
    let curvesRemoved = new cv.Mat();
    // TODO: fix, bitwise_and should be used in another way
    cv.bitwise_not(gray, curvesRemoved, curvesMask);
    this.showImage("curvesRemoved", curvesRemoved);

    let curvesRemovedInverted = new cv.Mat();
    cv.bitwise_not(curvesRemoved, curvesRemovedInverted);
    this.showImage("curvesRemovedInverted", curvesRemovedInverted);

    // Create a black image to draw the vectorized lines
    let vectorized = this.vectorizeImage(imgSource);
    this.showImage("vectorized", vectorized);

    // Invert the colors
    let inverted = new cv.Mat();
    cv.bitwise_not(vectorized, inverted);
    this.showImage("inverted", inverted);

    for (let char of availableChars) {
      await this.matchCaptchaByLettersTemplate(gray, char);
    }

    // need to release them manually
    [imgSource, gray, vectorized, inverted].forEach((mat) => mat.delete());
  }

  async matchCaptchaByLettersTemplate(captcha, char) {
    let srcElement = document.getElementById("original-captcha");
    let templateElement = document.getElementById(`char-${char}`);
    let srcMat = cv.imread(srcElement, cv.IMREAD_GRAYSCALE);
    let template = cv.imread(templateElement, cv.IMREAD_GRAYSCALE);
    let destImg = new cv.Mat();
    let mask = new cv.Mat();
    // Perform template matching
    cv.matchTemplate(srcMat, template, destImg, cv.TM_CCOEFF_NORMED);
    // Get the location of the maximum value in the result matrix (top-left corner of detected area)
    let result = cv.minMaxLoc(destImg, mask);
    let maxPoint = result.maxLoc;
    // Draw a rectangle around the matched area
    let color = new cv.Scalar(255, 0, 0, 255);
    let point2 = new cv.Point(
      maxPoint.x + template.cols,
      maxPoint.y + template.rows
    );
    console.log(">>> debug", template.cols, template.rows, {
      result,
      maxPoint,
      color,
      point2,
      char,
    });
    cv.rectangle(srcMat, maxPoint, point2, color, 2, cv.LINE_8, 0);
    // Display the result
    this.showImage("Char: " + char, srcMat);
  }

  vectorizeImage(mat) {
    // Apply Canny edge detection to the grayscale image
    let edges = new cv.Mat();
    // cv.Canny(gray, edges, 50, 150);
    cv.Canny(mat, edges, 50, 150);

    // Create a kernel for morphological operations
    let kernel = cv.Mat.ones(3, 3, cv.CV_8U);

    // Dilate the edges to make the lines thicker
    let dilatedEdges = new cv.Mat();
    cv.dilate(edges, dilatedEdges, kernel);

    // Find contours in the dilated edges
    let contours = new cv.MatVector();
    cv.findContours(
      dilatedEdges,
      contours,
      new cv.Mat(),
      cv.RETR_TREE,
      cv.CHAIN_APPROX_SIMPLE
    );

    // Create a black image to draw the vectorized lines
    let vectorized = new cv.Mat.zeros(mat.rows, mat.cols, cv.CV_8UC3);

    // Draw the contours on the vectorized image
    let color = new cv.Scalar(255, 255, 255); // White color
    for (let i = 0; i < contours.size(); i++) {
      cv.drawContours(vectorized, contours, i, color, 2); // Draw with a thickness of 2
    }
    return vectorized;
  }

  showImage(imageId, openCvImage) {
    const container = document.querySelector(".images-container");
    const wrapper = document.createElement("div");
    wrapper.className = "image-card";
    const title = document.createElement("div");
    title.innerText = imageId;
    wrapper.appendChild(title);
    const canvas = document.createElement("canvas");
    canvas.id = imageId;
    cv.imshow(canvas, openCvImage);
    wrapper.appendChild(canvas);
    container.appendChild(wrapper);
  }

  render() {
    const { imgUrl } = this.state;
    return (
      <div>
        <div style={{ marginTop: "30px" }}>
          <span style={{ marginRight: "10px" }}>Select an image file:</span>
          <input
            type="file"
            name="file"
            accept="image/*"
            onChange={(e) => {
              if (e.target.files[0]) {
                this.setState({
                  imgUrl: URL.createObjectURL(e.target.files[0]),
                });
              }
            }}
          />
        </div>

        {availableChars.map((char) => (
          <img
            key={char}
            alt={char}
            id={`char-${char}`}
            src={charToImageUrl[char]}
            crossOrigin="anonymous"
          />
        ))}

        {imgUrl && (
          <>
            <div className="image-card">
              <div>↓↓↓ The original image ↓↓↓</div>
              <img
                alt="Original input"
                id="original-captcha"
                src={imgUrl}
                crossOrigin="anonymous"
                onLoad={async (e) => {
                  try {
                    await this.waitForOpenCvLoaded();
                    void this.processImage(e.target);
                  } catch (error) {
                    console.error(error);
                  }
                }}
              />
            </div>
            <div className="images-container"></div>
          </>
        )}
      </div>
    );
  }
}

export default TestPage;

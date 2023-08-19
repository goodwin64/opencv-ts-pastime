import React from "react";
import cv from "@techstark/opencv-js";
import "./style.css";

window.cv = cv;

class TestPage extends React.Component {
  constructor(props) {
    super(props);
    this.inputImgRef = React.createRef();
    this.resultImageRef = React.createRef();
    this.state = {
      // if we want to load by URL from the beginning - specify the URL here;
      // otherwise, pick an image using file input
      imgUrl: "",
    };
  }

  waitForOpenCvLoaded() {
    return new Promise((resolve) => {
      cv["onRuntimeInitialized"] = () => {
        return resolve();
      };
    });
  }

  /////////////////////////////////////////
  //
  // process image with opencv.js
  //
  /////////////////////////////////////////
  processImage(imgSrc) {
    const imgSource = cv.imread(imgSrc);

    // Convert the image to grayscale
    let gray = new cv.Mat();
    cv.cvtColor(imgSource, gray, cv.COLOR_RGBA2GRAY);
    this.showImage("gray", gray);

    // Apply threshold to create a binary image
    let thresholded = new cv.Mat();
    cv.threshold(gray, thresholded, 235, 255, cv.THRESH_BINARY);
    this.showImage("thresholded", thresholded);

    // Define a kernel for morphological operations
    let kernel = cv.Mat.ones(3, 3, cv.CV_8U);

    // Perform morphological opening (erosion followed by dilation)
    let opened = new cv.Mat();
    cv.morphologyEx(thresholded, opened, cv.MORPH_OPEN, kernel);
    this.showImage("opened", opened);

    // Find the difference between the opened image and the original thresholded image
    let difference = new cv.Mat();
    cv.absdiff(opened, thresholded, difference);
    this.showImage("difference", difference);

    // Create a mask where non-zero pixels indicate noise
    let noiseMask = new cv.Mat();
    cv.threshold(difference, noiseMask, 1, 255, cv.THRESH_BINARY);
    this.showImage("noiseMask", noiseMask);

    // Remove noise by applying the mask to the original image
    let result = new cv.Mat();
    imgSource.copyTo(result, noiseMask);

    // render result image
    this.showImage("result", result);

    // need to release them manually
    [
      imgSource,
      gray,
      thresholded,
      opened,
      difference,
      noiseMask,
      result,
    ].forEach((mat) => mat.delete());
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

        {imgUrl && (
          <div className="images-container">
            <div className="image-card">
              <div>↓↓↓ The original image ↓↓↓</div>
              <img
                alt="Original input"
                src={imgUrl}
                crossOrigin="anonymous"
                onLoad={(e) => {
                  try {
                    this.waitForOpenCvLoaded().then(() => {
                      this.processImage(e.target);
                    });
                  } catch (error) {
                    console.error(error);
                  }
                }}
              />
            </div>
          </div>
        )}
      </div>
    );
  }
}

export default TestPage;

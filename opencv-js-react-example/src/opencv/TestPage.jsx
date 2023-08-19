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

    // Apply Canny edge detection to the grayscale image
    let edges = new cv.Mat();
    cv.Canny(gray, edges, 50, 150);
    this.showImage("edges", edges);

    // Create a kernel for morphological operations
    let kernel = cv.Mat.ones(3, 3, cv.CV_8U);

    // Dilate the edges to make the lines thicker
    let dilatedEdges = new cv.Mat();
    cv.dilate(edges, dilatedEdges, kernel);
    this.showImage("dilatedEdges", dilatedEdges);

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
    let vectorized = new cv.Mat.zeros(
      imgSource.rows,
      imgSource.cols,
      cv.CV_8UC3
    );

    // Draw the contours on the vectorized image
    let color = new cv.Scalar(255, 255, 255); // White color
    for (let i = 0; i < contours.size(); i++) {
      cv.drawContours(vectorized, contours, i, color, 2); // Draw with a thickness of 2
    }
    this.showImage("vectorized", vectorized);

    // Invert the colors
    let inverted = new cv.Mat();
    cv.bitwise_not(vectorized, inverted);
    this.showImage("inverted", inverted);

    // need to release them manually
    [
      imgSource,
      gray,
      edges,
      kernel,
      dilatedEdges,
      contours,
      vectorized,
      inverted,
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

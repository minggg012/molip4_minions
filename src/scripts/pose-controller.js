/*
Copyright 2019 Google LLC

Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
*/

import config from '../config';
import * as posenet from '@tensorflow-models/posenet';
import PosenetRenderer from './posenet-renderer';
import { smooth, smoothNum, smoothSound } from './smoothing';
import { getKeypoint, getKeypoints, getMidpoint, getDistance, getAverageDifference, getDistanceFromOrigin, arrayWithLargestVariation } from './helpers';
import { thresholdedReLU } from '@tensorflow/tfjs-layers/dist/exports_layers';

// FYI -- 'leftWrist' is actually your right wrist ¯\_(ツ)_/¯ 
var vi = document.getElementById("vi");


export default class PoseController {
  constructor(props) {
    this.props = props;
    this.armspan = 400;
    this.isCalculatingSpeed = false;
    this.initialized = false;
    this.playedFirstNote = false;
    this.isEstimatingPose = false;
    this.stoppingTimeout = { timeout: null, pose: null };
    this.slide_to_next = false;
    this.slide_to_prev = false;
    this.video_urls = [{url: 'http://localhost:1234/videos/ttuch.mp4', title: '뚜찌빠찌뽀'}, {url: 'http://localhost:1234/videos/bananasong.mp4', title: '바나나송'}]
    this.index = 0;
    this.p = document.getElementById("title");
    this.img_idx = 0;
    this.up = 0;
    this.gif = false;
    this.tempo = 0;
    this.four = false;
    this.zero = false;
    this.state0 = document.querySelectorAll('.zero');
    this.state1 = document.querySelectorAll('.one');
    this.state2 = document.querySelectorAll('.two');
    this.state3 = document.querySelectorAll('.three');
    this.state4 = document.querySelectorAll('.four');
    this.ten = 0;
    this.num = 5;
    this.List = [this.state0, this.state1, this.state2, this.state3, this.state4];
  }

  /* Create the video/canvas objects and start the neural net */
  async initialize() {
    this.video = await this.props.renderer.loadVideo();
    if (!this.video) return;

    this.video.play();

    const canvas = this.props.renderer.setupVideoCanvas();
    this.posenetRenderer = new PosenetRenderer({
      state: this.props.state,
      canvas: canvas
    });

    this.net = await posenet.load(config.posenet.mobileNetArchitecture);
    this.initialized = true;
    this.p.innerText = this.video_urls[0].title;
    //setInterval((()=>{this.interval()}), 10);
    this.loop();   
  }

  /* Main pose detection loop */
  async loop() {
    if (this.isEstimatingPose) { 
      requestAnimationFrame(this.loop.bind(this)); 
      return;
    }

    this.isEstimatingPose = true;
    this.pose = await this.getPose();
    this.isEstimatingPose = false;

    if (!this.pose) {
      this.props.setTempo(0);
    }
    /*
    else{
      if(this.poses.length<1000){
        this.poses.push(this.pose);
      }
      else{
        this.poses.push(this.pose);
        this.poses.shift()
      }
      if(this.getPattern()) console.log("pattern!!");
    }*/

    if (this.pose && this.props.state.calibrating) {
      if (this.detectCalibrationPose()) this.handleCalibration();
    }

    if (this.pose && this.props.state.conducting) {
      this.detectTempo().then((tempo) => {
        if (this.playedFirstNote) this.props.setTempo(tempo);
        this.tempo = tempo;
        this.num = (config.detection.maximumBpm/this.tempo)**2;
      }).catch(() => { /* Ignore */ });

      
      setTimeout(( ()=>{
        this.List[this.img_idx-this.up].forEach((item) => item.style.display = 'none');
        this.List[this.img_idx].forEach((item) => item.style.display = 'inline');
        // this.List[0].forEach((item) => console.log("item"+item));
        if(this.ten<this.num){
          this.ten++;
          return;
        }
        else{
          this.ten = 0;
        }
        if (this.img_idx === 4) {
          if(!this.four){
            this.up = 0;
          }
          else this.up = -1;
          this.four = !this.four;
        }
        else if (this.img_idx === 0) {
          if(!this.zero){
            this.up = 0;
          }
          else this.up = 1;
          this.zero = !this.zero;
          }
        this.img_idx += this.up;
      }), ((1/this.tempo)**4));

      this.props.setInstrumentGroup(this.getHandZone());
      console.log("getnor"+this.getNormalisedHeight());
      this.props.setVelocity(this.getNormalisedHeight());
      this.props.setSound(this.getNormalisedHeight());
      this.setStoppingTimeout(); // Stop if hands not moving
      this.slideToNext().then((slide_to_next) => {
        if (!this.slide_to_next && slide_to_next) {
          this.slide_to_next = true;
          if(this.index<this.video_urls.length-1){
            const video = this.video_urls[++this.index];
            vi.src = video.url;
            vi.load();
            vi.play();
            console.log("Slide to Next");
            title.innerText = video.title;
            setTimeout((() => {this.slide_to_next = false}), 1000);
          }
        }
      });
      this.slideToPrev().then((slide_to_prev) => {
        if (!this.slide_to_prev && slide_to_prev) {
          this.slide_to_prev = true;
          if(this.index>0){
            const video = this.video_urls[--this.index];
            vi.src = video.url;
            vi.load();
            vi.play();
            title.innerText = video.title;
            setTimeout((() => {this.slide_to_next = false}), 1000);
          }
          console.log("Slide to Prev"); 
          setTimeout((() => {this.slide_to_prev = false}), 1000);
        }        
      });
    }

    this.posenetRenderer.drawFrame(this.video, this.pose);
    requestAnimationFrame(this.loop.bind(this));
  }

  /* Get pose from Posenet and apply smoothing */
  async getPose() {
    const posenetArgs = [
      this.video,
      config.posenet.imageScaleFactor,
      config.posenet.flipHorizontal,
      config.posenet.outputStride
    ];

    // Detect the pose
    let pose;
    if (config.posenet.algorithm === 'single-pose') {
      pose = await this.net.estimateSinglePose(...posenetArgs)
    } else {
      const poses = await this.net.estimateMultiplePoses(...posenetArgs);
      if (poses.length === 0) {
        return;
      }
      // Take the pose with the highest score
      // pose = poses.reduce((prev, current) => (prev.score >= current.score) ? prev : current);
      pose = poses[0];
    }

    if (pose.score >= config.posenet.minPoseConfidence) {
      this.poseVisible = true;
      return smooth(pose, this.armspan);
    } else {
      this.poseVisible = false;
      console.log("Stop");
      this.props.stop();
      return;
    }
  }

  /* Calibration detection methods */

  detectCalibrationPose() {
    const parts = getKeypoints(this.pose, [
      'leftWrist', 'rightWrist', 'leftElbow',
      'rightElbow', 'leftShoulder', 'rightShoulder'
    ]);
    const margin = config.detection.calibrationMargin;
    const maxDist = config.display.width;
    
    // Look for a T-shape pose, with hands in line with elbows and shoulders
    return (
      // this.handsVisible() &&
      (parts.leftWrist.position.y < parts.leftShoulder.position.y + margin) &&
      (parts.leftWrist.position.y > parts.leftShoulder.position.y - margin) &&
      
      (parts.rightWrist.position.y < parts.rightShoulder.position.y + margin) &&
      (parts.rightWrist.position.y > parts.rightShoulder.position.y - margin) &&
      
      (parts.leftWrist.position.y < parts.leftElbow.position.y + margin) &&
      (parts.leftWrist.position.y > parts.leftElbow.position.y - margin) &&
      
      (parts.rightWrist.position.y < parts.rightElbow.position.y + margin) &&
      (parts.rightWrist.position.y > parts.rightElbow.position.y - margin) && 
      
      (parts.leftWrist.position.x > 0) && (parts.leftWrist.position.x < maxDist) &&
      (parts.rightWrist.position.x > 0) && (parts.rightWrist.position.x < maxDist)
    );
  }

  handleCalibration() {
    this.armspan = this.getHandDistance();
    this.props.handleCalibration();
  }

  /* Tempo detection */
  async detectTempo() {
    if (this.isCalculatingSpeed) throw 'Waiting for calculation to complete.';
    this.isCalculatingSpeed = true;

    const num = config.detection.distanceMeasurementNumber;
    const interval = config.detection.distanceMeasurementInterval;

    // Get an array of each hand's distance from the origin at various intervals
    const distances = [[], []];
    for (let i = 0; i < num; i++) {
      setTimeout(() => {
        if (!this.pose) return;
        const leftHand = getKeypoint(this.pose, 'leftWrist');
        const rightHand = getKeypoint(this.pose, 'rightWrist');
        distances[0].push(getDistanceFromOrigin(leftHand.position));
        distances[1].push(getDistanceFromOrigin(rightHand.position));
      }, interval * i);
    }

    // After the above finishes, find the hand that moved the most,
    // and get bpm based on that hand's speed
    return new Promise((resolve) => {
      setTimeout((() => {
        const conductingHandDistances = arrayWithLargestVariation(distances);
        const speed = this.getBpmFromDistances(conductingHandDistances, interval);
        let bpm = smoothNum(speed, config.smoothing.speedSmoothing);
        bpm = Math.min(bpm, config.detection.maximumBpm);
        console.log(bpm);
        this.isCalculatingSpeed = false;
        resolve(bpm);
      }).bind(this), interval * num + 1)
    })
  }

  interval() {
    console.log("interval")
    setTimeout(( ()=>{
      this.List[this.img_idx-this.up].forEach((item) => item.style.display = 'none');
      this.List[this.img_idx].forEach((item) => item.style.display = 'inline');
      // this.List[0].forEach((item) => console.log("item"+item));
      if(this.ten!=10){
        this.ten++;
        return;
      }
      else{
        this.ten = 0;
      }
      if (this.img_idx === 4) {
        if(!this.four){
          this.up = 0;
        }
        else this.up = -1;
        this.four = !this.four;
      }
      else if (this.img_idx === 0) {
        if(!this.zero){
          this.up = 0;
        }
        else this.up = 1;
        this.zero = !this.zero;
        }
      this.img_idx += this.up;
    }), ((1/this.tempo)**4));
  }

  /* Get a list of positions and interval between measurements, return bpm */
  getBpmFromDistances(distances, interval) {
    const avg = getAverageDifference(distances);
    const pxPerMs = avg / interval;
    const pxPerMinute = pxPerMs * 1000 * 60;
    const beatDistance = this.armspan * config.detection.beatDistanceArmspanRatio;
    const beatsPerMinute = pxPerMinute / beatDistance;
    console.log(`bpm:${beatsPerMinute}`);
    return beatsPerMinute;
  }

  /* Stop music if hands not moving */
  setStoppingTimeout() {
    if (this.stoppingTimeout.timeout) return; // Already in progress
    const factor = config.detection.beatLengthStoppingIntervalRatio;
    const max = config.detection.stoppingDistanceArmspanRatio * this.armspan;
    const interval = this.props.getBeatLength() * factor;

    this.stoppingTimeout.timeout = setTimeout(() => {
      this.stoppingTimeout.timeout = null;
      // Get previous pose and this pose, return if no previous pose
      const lastPose = this.stoppingTimeout.pose;
      const thisPose = this.stoppingTimeout.pose = this.pose;
      if (!lastPose || !thisPose) return;

      // Calculate positions & difference between before & after interval
      const lastLeftWrist = getKeypoint(lastPose, 'leftWrist');
      const thisLeftWrist = getKeypoint(thisPose, 'leftWrist');
      const lastRightWrist = getKeypoint(lastPose, 'rightWrist');
      const thisRightWrist = getKeypoint(thisPose, 'rightWrist');
      const diff1 = getDistance(lastLeftWrist.position, thisLeftWrist.position);
      const diff2 = getDistance(lastRightWrist.position, thisRightWrist.position);

      // If difference is small enough, stop music
      if (diff1 < max && diff2 < max) {
        //console.log("stop");
        this.props.stop();
      } else {
        if (this.props.state.conducting && this.poseVisible) {
          this.playedFirstNote = true;
          this.props.start();
        }
      }
    }, interval);
  }


  /* Check if hands are reliably in scene */
  handsVisible() {
    const leftWrist = getKeypoint(this.pose, 'leftWrist');
    const rightWrist = getKeypoint(this.pose, 'rightWrist');
    
    return (
      leftWrist.score > config.posenet.minPartConfidence
      && rightWrist.score > config.posenet.minPartConfidence
    );
  }

  /* Gets distance between leftWrist and rightWrist keypoints at any one time */
  getHandDistance() {
    const leftWrist = getKeypoint(this.pose, 'leftWrist');
    const rightWrist = getKeypoint(this.pose, 'rightWrist');
    return getDistance(leftWrist.position, rightWrist.position);
  }

  /* Check whether hands are to the left, right or center */
  getHandZone() {
    const leftWrist = getKeypoint(this.pose, 'leftWrist');
    const rightWrist = getKeypoint(this.pose, 'rightWrist');
    const midpoint = getMidpoint(leftWrist, rightWrist);
    const zones = config.zones;

    for (let i = 0; i < zones.length; i++) {
      if (zones[i].start < midpoint && midpoint < zones[i].end) return i;
    }
  }

  getNormalisedHeight() {
    const leftWrist = getKeypoint(this.pose, 'leftWrist');
    const rightWrist = getKeypoint(this.pose, 'rightWrist');
    const highestY = Math.min(leftWrist.position.y, rightWrist.position.y);
    const normalisedHeight = (1 - highestY / config.display.height);
    console.log(normalisedHeight);
    const sound = smoothSound(normalisedHeight, config.smoothing.soundSmoothing);
    return sound;
  }

  getPattern() {
    const positionX = this.poses.map(p=>getKeypoint(p, 'rightWrist').position.x);
    const max = Math.max(...positionX);
    const min = Math.min(...positionX);
    //console.log(max-min);
    //console.log(max, min);
    //console.log(positionX)
    const index_max_x = positionX.indexOf(max);
    const index_min_x = positionX.indexOf(min);
    //console.log(index_max_x, index_min_x)
    if((max-min>230) && (index_max_x<index_min_x)){
      console.log("!!!!!");
      const arr = this.poses.slice(index_min_x, index_max_x);
      const positionY = arr.map(p=>getKeypoint(p, 'rightWrist').position.y);
      //console.log(Math.max(...positionY), Math.min(...positionY));
      const max_y = Math.max(...positionY);
      const min_y = Math.min(...positionY);
      if((max_y-min_y)<120) {
        /*var source = document.createElement('source');
        source.setAttribute('src', './10.mp4');
        source.setAttribute('type', 'video/mp4');

        vi.appendChild(source);*/
        vi.src = '/bananasong.mp4';
        vi.load().then(() => console.log("loaded"));
        this.poses = [];
        console.log("next!!");
        //this.initialize();
      }

    }
    //console.log(positionY);

  }

  async slideToNext() {
    const num = config.detection.slideDecisionNumber;
    const interval = config.detection.slideDecisionInterval;
    let x_condition_satisfied = false;
    let y_condition_satisfied = false;
    let orgnLeftHand = getKeypoint(this.pose, 'leftWrist').position;
    let currLeftHand = getKeypoint(this.pose, 'leftWrist').position;
    let orgnRightHand = getKeypoint(this.pose, 'rightWrist').position;
    let currRightHand = getKeypoint(this.pose, 'rightWrist').position;
    for (let i = 0; i < num; i++) {
      setTimeout(() => {
        if (!this.pose) return;
        currLeftHand = getKeypoint(this.pose, 'leftWrist').position;
        currRightHand = getKeypoint(this.pose, 'rightWrist').position;
        if (getDistance(orgnRightHand, currRightHand) < 10) {
          if (orgnLeftHand.x - currLeftHand.x > 60) {
            x_condition_satisfied = true;
          } else x_condition_satisfied = false;
          if (Math.abs(orgnLeftHand.y - currLeftHand.y) < 40) {
            y_condition_satisfied = true;
          } else y_condition_satisfied = false;
        } else {
          x_condition_satisfied = false;
          y_condition_satisfied = false;
        }
        orgnLeftHand = currLeftHand;
        orgnRightHand = currRightHand;
      }, interval * i);
    }
    return new Promise((resolve) => {
      setTimeout((() => {
        resolve(x_condition_satisfied && y_condition_satisfied);
      }).bind(this), interval * num + 1)
    })
  }

  async slideToPrev() {
    const num = config.detection.slideDecisionNumber;
    const interval = config.detection.slideDecisionInterval;
    let x_condition_satisfied = false;
    let y_condition_satisfied = false;
    let orgnLeftHand = getKeypoint(this.pose, 'leftWrist').position;
    let currLeftHand = getKeypoint(this.pose, 'leftWrist').position;
    let orgnRightHand = getKeypoint(this.pose, 'rightWrist').position;
    let currRightHand = getKeypoint(this.pose, 'rightWrist').position;
    for (let i = 0; i < num; i++) {
      setTimeout(() => {
        if (!this.pose) return;
        currLeftHand = getKeypoint(this.pose, 'leftWrist').position;
        currRightHand = getKeypoint(this.pose, 'rightWrist').position;
        if (getDistance(orgnLeftHand, currLeftHand) < 10) {
          if (currRightHand.x - orgnRightHand.x > 60) {
            x_condition_satisfied = true;
          } else x_condition_satisfied = false;
          if (Math.abs(orgnRightHand.y - currRightHand.y) < 40) {
            y_condition_satisfied = true;
          } else y_condition_satisfied = false;
        } else {
          x_condition_satisfied = false;
          y_condition_satisfied = false;
        }
        orgnLeftHand = currLeftHand;
        orgnRightHand = currRightHand;
      }, interval * i);
    }
    return new Promise((resolve) => {
      setTimeout((() => {
        resolve(x_condition_satisfied && y_condition_satisfied);
      }).bind(this), interval * num + 1)
    })
  }


}

vi.addEventListener('loadedstart', (event) => {
  console.log("loadedstart");
});

vi.addEventListener('loadeddata', (event) => {
  console.log("loaded");
});
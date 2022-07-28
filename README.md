# 병재와 민이언즈
> 2022 여름 몰입캠프 2분반 박병현 김민 정재모
- 딥러닝 기반 posenet을 이용하여 미니언즈 합창단 구현


## A. 개발 팀원
- DGIST 기초학부 [박병현](http://github.com/ByeongHyunPak)
- KAIST 전산학부 [김민](http://github.com/minggg012)
- KAIST 전산학부 [정재모](http://github.com/Jaemojung)

## B. 개발 환경
> html, css, javascript
> 
> tensorflow.js posenet

## C. 프로젝트 설명
### 1. Loading Page
<img width="1512" alt="start" src="https://user-images.githubusercontent.com/85171279/181438278-aadbb13a-a55d-4fa6-b18f-73260e8b8bad.png">

#### Major Features
- 직접 만든 로고가 gif 형식으로 띄워져 있다.
- 접속하는 동안 로딩 중이라는 문구가 뜨고, 로딩이 완료되면 START 버튼을 눌러 다음 페이지로 넘어갈 수 있다.


--------------------------------------


### 2. File Register Page
<img width="1512" alt="register" src="https://user-images.githubusercontent.com/85171279/181438370-2d6a98ee-cee9-43c0-9e77-f958435f38ba.png">

#### Major Features
- 원하는 영상을 형식에 맞춰 직접 넣을 수 있다 (여러번 등록할 수 있다).
- 지휘하는 동안 뜰 제목을 직접 입력하여 넣을 수 있다.
- 넣고 싶은 영상이 없거나 원하는 영상을 넣었다면 START 버튼을 눌러 다음 페이지로 넘어갈 수 있다.


-------------------------------


### 3. Main Page
<img width="1512" alt="main1" src="https://user-images.githubusercontent.com/85171279/181438397-3f7a7dfd-b4cf-4714-92b6-fd4b83a7fbba.png">

#### Major Features
- 노트북에 달린 카메라를 이용하여 사용자의 얼굴, 몸통, 팔을 인식한다.
- 지휘자가 인식되면 곡이 시작된다.
- 지휘 방법은 다음과 같다.
  - 팔의 높낮이에 따라 노래의 크기가 변하고, 화면에 나타난다.
  - 팔의 움직임의 빠르기에 따라 노래의 템포가 변하고, 화면에 나타난다.
  - 팔을 오른쪽에서 왼쪽으로 빠르게 한 번 움직이면 이전 곡으로, 왼쪽에서 오른쪽으로 빠르게 한 번 움직이면 다음 곡으로 넘어갈 수 있다.
- 지휘에 따라 미니언들이 노래를 부르며, 템포에 맞게 입모양의 속도가 달라진다.
- restart 버튼을 눌러 다시 시작할 수 있다.

#### Implementation Methods
- 0.5초 간격으로 5개의 손 위치를 파악하여 템포를 계산한다.
- 0.5초 간격으로 5개의 손 높이를 파악하여 소리 크기를 계산한다.
- 이전 곡과 다음 곡으로 넘어가는 것도 같은 method 이며, 이를 이용해 다른 동작을 추가할 수 있다.

--------------------------------------------------


### 4. Ending Page
<img width="1512" alt="ending" src="https://user-images.githubusercontent.com/85171279/181440186-25003484-499b-4485-b032-26a8d662a675.jpg">

#### Major Features
- 노래 지휘가 끝나면 엔딩 페이지가 나온다.
- play again 버튼을 눌러 다시 시작할 수 있다.

--------------------------------------------

### Future Working
- 미니언즈 뿐만 아니라 앨빈과 슈퍼밴드의 다람쥐들, 토이스토리 등등 여러 캐릭터 가수를 만들 예정.
- 소리, 템포에 따라 미니언즈들의 색깔이나 크기 변화도 줄 예정.
- 이전 곡, 다음 곡으로 넘기는 동작 뿐만 아니라 여러 기능에 대한 동작을 추가할 예정.
- 소리를 분리해서 각 미니언들을 따로 조종할 수 있도록 할 예정.

otps.innerHTML = `
<span>유저이름<span>
<input type="text" id="userUqName" value=""></input>
<span>roomId</span>
<input type="text" id="userroomId" value="${roomId}"></input>
<button id="roomAdmission" onclick="getContractUrl()">OTP 가지고오기</button>
<p id="otpId"></p>
`;

btns.innerHTML = `
<div>
<button onclick="setCreateRoomId()">방생성하기</button>
<p id="roomIdOk"></p>
</div>
`;

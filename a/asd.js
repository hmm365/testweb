document.addEventListener("DOMContentLoaded", function () {
  var serviceServerUrl = document.querySelector(".serverUrl").value;
  var UI = {};
  UI.Media = {
    init: function () {
      let THIS = this;

      if (!GM.Media) return;
      GM.Media.init(document.querySelector(".mediashare-view-wrapper"));

      THIS.mediaLayer = document.querySelector(".mediashare-layer");
      THIS.mediaList = THIS.mediaLayer.querySelector(".mediashare-list");
      THIS.mediaLayer.addEventListener("click", function (event) {
        if (event.target.id === "btnUploadMediaUrl") {
          let url = window.prompt("미디어 url 입력. cors 설정 필수!");
          url = url && url.trim();
          if (!url) return;

          let filename = window.prompt(
            "'파일 이름.확장자' 입력.\n입력을 안할 시 url의 마지막 '/' 이후의 string으로 파일이름으로 대체됩니다."
          );
          filename = filename && filename.trim();

          console.debug("media upload info ", url, filename);

          if (
            !confirm(
              `입력하신 정보\nurl : ${url}\n파일이름: ${filename}\n맞습니까?`
            )
          ) {
            return;
          }
          let successCallback = () => {
            console.log("success upload media url");
          };
          let errorCallback = (e) => {
            console.error("error fail upload media url", e);
          };
          GM.Media.uploadMediaFileFromUrl(
            {
              url: url,
              filename: filename,
            },
            successCallback,
            errorCallback
          );
        } else if (event.target.matches(".repeatBtn")) {
          let playType = event.target.dataset.repeatType;
          GM.Media.setRoomMediaSharePlayType(playType)
            .then(() => {})
            .catch((e) => {
              console.error(e);
            });
        } else if (event.target.matches(".ellipsis .btn-del")) {
          event.stopPropagation();
          let item = event.target.closest(".ellipsis");
          let sourceId = item.getAttribute("data-sourceid");
          if (!sourceId) {
            return;
          }

          if (confirm("삭제하시겠습니까?")) {
            GM.Media.removeShareMediaFile(sourceId);
          }
        }
      });
      //play
      THIS.mediaList.addEventListener("click", function (event) {
        if (event.target.matches("[data-sourceid]")) {
          let dataSourceId = event.target.getAttribute("data-sourceid");
          if (!dataSourceId) {
            return;
          }
          GM.Media.shareMediaPlayerPlay(0, dataSourceId);
        }
      });
    },

    setInfo: function () {
      let THIS = this;

      if (!GM.Media) return;

      GM.Media.setInfo();

      // play type
      let repeatBtns = THIS.mediaLayer.querySelectorAll(".repeatBtn");
      for (let btn of repeatBtns) {
        btn.setAttribute("data-active", "false");
      }
      let activeRepeatBtn = THIS.mediaLayer.querySelector(
        `.repeatBtn[data-repeat-type="${GM.Media.getPlayType()}"]`
      );
      activeRepeatBtn.setAttribute("data-active", "true");

      let mediaSource = GM.Media.getCurrentShareMediaSource();
      if (!mediaSource) {
        return;
      }
      // play title
      THIS.mediaLayer.querySelector(".titleRec").textContent =
        mediaSource.filename;
    },

    addShareMediaSource: function (user, mediaSource) {
      let THIS = this;
      let item = THIS.mediaList.querySelector(
        ".media-sample.ellipsis[data-upload]"
      );
      item = item.cloneNode(true);
      item.classList.remove("media-sample");
      item.setAttribute("data-sourceid", mediaSource.sourceId);
      item.setAttribute(
        "title",
        mediaSource.filename.replace(/</g, "&lt;").replace(/>/g, "&gt;")
      );
      item.setAttribute("data-upload", "complete");
      item.setAttribute("data-type", mediaSource.dataType);
      if (mediaSource.dataType === "url") {
        item.setAttribute("src", mediaSource.contents);
      }
      item.querySelector(".title").textContent = mediaSource.filename;

      let ct = mediaSource.duration;
      let mm = THIS.lpad("" + parseInt(ct / 60), 2, "0");
      let ss = THIS.lpad("" + parseInt(ct % 60), 2, "0");
      item.querySelector(".fileInfo").textContent = mm + ":" + ss;

      item.style.display = "block";
      THIS.mediaList.appendChild(item);
    },

    removeShareMediaSource: function (user, mediaSource) {
      let THIS = this;

      let item = THIS.mediaList.querySelector(
        `[data-sourceid="${mediaSource.sourceId}"]`
      );
      if (item) {
        item.remove();
      }
    },

    lpad: function (s, len, pad) {
      if (!pad) {
        return s;
      }

      let str = "" + s;
      while (str.length < len) {
        str = pad + str;
      }
      return str;
    },
  };

  // GoooroomeeMeeting create
  var GM = new GooroomeeMeeting({
    serviceServerUrl: "https://biz.gooroomee.com",
    settings: {
      bandWidth: {
        video: (function () {
          // TODO mobile ?
          return {
            send: "auto",
            receive: "auto",
          };
        })(),
      },
      deviceSetting: {
        useClientStream: true, // required requestClientStream event listen
        video: (function () {
          // TODO mobile ?
          return {
            width: 640,
            height: 360,
            frameRate: 15,
          };
        })(),
      },
    },
  });
  // test
  window.gm = GM;

  // init promise
  GM.init()
    .then(init)
    .then(function () {
      // add event listener
      for (var type in RoomEvent) {
        GM.on(type, RoomEvent[type]);
      }
    })
    .catch(function (e) {
      console.error("GM init fail", e);
    });

  function init() {
    const otpInput = document.querySelector(".otp");

    otpInput.addEventListener("focus", function () {
      this.select();
    });
    otpInput.focus();
    otpInput.select();

    // otp join
    const btnJoin = document.querySelector("#btn-join");
    btnJoin.addEventListener("click", function () {
      // get otp from server
      const otpValue = otpInput.value.trim();
      if (!otpValue) return;

      const audioOnly = document.querySelector("#chkAudioOnly").checked;

      const options = {
        otp: otpValue,
        camera: audioOnly ? "off" : "on",
        mic: "on",
        reqInfoList: ["roomUser", "roomDoc"],
      };

      const successCallback = function (info, me) {
        console.log("joinComplete :", info, me);

        setRoomInfo(info);

        // room user list
        info.roomUserList.forEach(function (user) {
          if (user.userId == me.userId) return;

          const selectUsers = document.querySelectorAll(".select-user");
          selectUsers.forEach(function (selectUser) {
            const option = document.createElement("option");
            option.text = user.nickname;
            option.value = user.userId;
            selectUser.appendChild(option);
          });
        });

        // room doc list
        const addRoomDoc = RoomEvent.addRoomDoc.bind(this);
        const setRoomDocPage = RoomEvent.setRoomDocPage.bind(this);
        info.roomDocInfo.roomDocList.forEach(function (roomDoc) {
          addRoomDoc(null, roomDoc);
          if (roomDoc.docId == info.roomDocInfo.docId) {
            setRoomDocPage(null, roomDoc);
          }
        });

        window.addEventListener("resize", function () {
          changeMixingLayout();
        });
        window.addEventListener("orientationchange", function () {
          changeMixingLayout();
        });
      };

      const errorCallback = function (errorCode, data) {
        switch (errorCode) {
          case "server_error":
            alert("서버 오류");
            return;
          case "invalid_room":
            alert("존재하지 않는 미팅룸");
            // exit
            break;
          case "room_full":
            alert("더이상 입장할 수 없음");
            break;
          case "room_not_started":
            const joinableTime = new Date(data.joinableTime);
            alert(`미팅룸이 시작되지 않음.\n입장가능시간 : ${joinableTime}`);
            break;
          case "room_password_not_matched":
            alert("비밀번호가 일치하지 않습니다.");
          case "room_password_required":
            const passwd = window.prompt("비밀번호 입력");
            if (passwd) {
              // rejoin
              options.passwd = passwd;
              GM.join(options, successCallback, errorCallback);
            }
            break;
          case "reserved_room_url_id":
            alert("지정된 방 URL ID");
            // exit
            break;
        }
      };

      // join room
      GM.join(options, successCallback, errorCallback);

      // Gooroomee Document init
      GM.Document.init(".doc-view", {
        useWheel: true,
        maxZoom: 5,
      });
    });

    // room mode
    const roomModeRadios = document.querySelectorAll('[name="roomMode"]');
    roomModeRadios.forEach(function (roomModeRadio) {
      roomModeRadio.addEventListener("click", function () {
        const mode = document.querySelector('[name="roomMode"]:checked').value;
        GM.changeRoomMode(mode);
      });
    });

    // change device
    const deviceListVideo = document.querySelector(".device-list-video");
    const deviceListAudio = document.querySelector(".device-list-audio");
    deviceListVideo.addEventListener("change", function () {
      GM.changeInputDevice(deviceListVideo.value, deviceListAudio.value);
    });
    deviceListAudio.addEventListener("change", function () {
      GM.changeInputDevice(deviceListVideo.value, deviceListAudio.value);
    });
    // device on/off
    document
      .querySelector(".device-controls")
      .addEventListener("click", function (event) {
        var target = event.target;
        if (target.matches(".btn-screen-capture")) {
          var format = "jpg";
          GM.captureScreen({
            format: format,
            quality: 90,
          }).then(function (result) {
            var view = document.querySelector(".preview-screen-capture");
            view.removeEventListener(".psc", function (e) {});
            view.addEventListener("click", function (e) {
              var btn = e.target.getAttribute("data-btn");
              switch (btn) {
                case "close":
                  view.close();
                  break;
                case "download":
                  var a = document.createElement("a");
                  a.href = result.dataUrl;
                  a.download = "gooroomee-screenshot-" + Date.now() + ".jpg";
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  break;
                case "upload":
                  view.close();
                  var status = document.querySelector(".upload-doc-status");
                  GM.Document.upload(result.blob, {
                    error: function (error) {
                      switch (error.name) {
                        case "uploadError":
                          console.error("uploadError", error);

                          // TODO
                          break;
                        case "unsupportedTypeError":
                          console.error("unsupportedTypeError", error);

                          // TODO
                          break;
                        default:
                          console.error("upload error", error);

                          // TODO
                          break;
                      }
                    },
                    start: function (file) {
                      status.textContent = "전송 시작 : " + file.name;
                    },
                    progress: function (file, loaded, total) {
                      var percent = parseInt(100 * (loaded / total));
                      status.textContent =
                        "전송 : " + file.name + ", " + percent + "%";
                    },
                    complete: function () {},
                  });
                  break;
              }
            });

            var src = URL.createObjectURL(result.blob);

            view
              .querySelector(".preview img")
              .addEventListener("load", function () {
                URL.revokeObjectURL(this.src);
              });
            view.querySelector(".preview img").setAttribute("src", src);

            view.showModal();
          });
        } else if (target.matches(".btn-screen")) {
          var me = GM.getRoomUser("me");
          var videoLayer = getUserVideoLayer(me.userId);

          if (GM.isScreenShare()) {
            var screenVideos = videoLayer.querySelectorAll(
              'video[video-type="screen"]'
            );
            screenVideos.forEach(function (video) {
              video.parentNode.removeChild(video);
            });

            var otherVideos = videoLayer.querySelectorAll(
              'video:not([video-type="screen"])'
            );
            otherVideos.forEach(function (video) {
              video.style.display = "block";
              video.play();
            });

            GM.stopScreenShare();
          } else {
            GM.startScreenShare(["screen", "window", "audio"], 10)
              .then(function (stream) {
                var screenVideo = videoLayer.querySelector(
                  'video[video-type="screen"]'
                );
                if (!screenVideo) {
                  screenVideo = document.createElement("video");
                  screenVideo.setAttribute("video-type", "screen");
                  screenVideo.autoplay = true;
                  videoLayer.appendChild(screenVideo);
                  screenVideo.muted = true;

                  GM.UserMedia.attachMediaStream(screenVideo, stream);
                  screenVideo.play();
                }
                var otherVideos = videoLayer.querySelectorAll(
                  'video:not([video-type="screen"])'
                );
                otherVideos.forEach(function (video) {
                  video.style.display = "none";
                });
              })
              .catch(function (e) {
                console.error("start screen share error :", e);
                switch (e) {
                  case "not-installed": // 미설치
                    var dialog = document.querySelector(
                      ".install-grm-extension"
                    );
                    dialog.addEventListener("click", function (e) {
                      var button = e.target;
                      if (button.matches(".install")) {
                        window.open(
                          GM.getGooroomeeExtensionInstallUrl(),
                          "_grm_ext_install"
                        );
                        dialog.close();
                      } else if (button.matches(".close")) {
                        dialog.close();
                      }
                    });
                    dialog.showModal();
                    break;
                }
              });
          }
        } else if (target.matches(".btn-control")) {
          var user = GM.getRoomUser("me");
          var deviceType = target.getAttribute("data-type");
          var deviceStatus = user[deviceType + "Status"];

          if (deviceStatus === "none") {
            return;
          }

          GM.changeDeviceStatus(
            deviceType,
            deviceStatus === "on" ? "off" : "on"
          );
        } else if (
          target.matches('.noise-cancel-control[data-type="noise-cancel"]')
        ) {
          GM.toggleNoiseCancel();
        } else if (
          target.matches('.noise-cancel-control[data-type="noise-cancel-on"]')
        ) {
          GM.startNoiseCancel();
        } else if (
          target.matches('.noise-cancel-control[data-type="noise-cancel-off"]')
        ) {
          GM.stopNoiseCancel();
        } else if (
          target.matches(
            '.noise-cancel-control[data-type="noise-cancel-status"]'
          )
        ) {
          var noiseCancelStatus = GM.getNoiseCancelStatus();
          alert("노이즈 캔슬 " + (noiseCancelStatus ? "ON" : "OFF"));
        }
      });

    document
      .querySelector(".camera-control")
      .addEventListener("change", function (event) {
        var target = event.target;
        if (target.matches(".cons")) {
          var constraints = {};
          constraints[target.dataset.type] = target.value;
          GM.applyLocalVideoTrackConstraints(constraints);
        }
      });

    var recordTime = document.querySelector(".record-controls .record-time");
    var recordingTimer;
    function recordTimer(stateData) {
      window.clearTimeout(recordingTimer);

      var recordingTime = parseInt(stateData.recordingTime / 1000);
      var hours = parseInt(recordingTime / 60 / 60);
      var minutes = parseInt((recordingTime / 60) % 60);
      var seconds = parseInt(recordingTime % 60);

      function pad(s) {
        s = "" + s;
        while (s.length < 2) s = "0" + s;
        return s;
      }
      var time = pad(hours) + ":" + pad(minutes) + ":" + pad(seconds);
      recordTime.innerHTML = time;

      switch (stateData.state) {
        case "recording":
          stateData.recordingTime += 1000;
          recordingTimer = window.setTimeout(recordTimer, 1000, stateData);
          break;
        case "paused":
          break;
        case "stopping":
        case "inactive":
          recordTime.innerHTML = "";
          break;
      }
    }

    var record = document.querySelector(".record-controls");
    record.addEventListener("change-state", function (event) {
      var stateData = event.stateData;
      recordTimer(stateData);

      var stateText = {
        recording: "녹화중",
        paused: "녹화일시정지",
        stopping: "녹화정지중",
        inactive: "녹화정지",
      };
      record.querySelector(".record-state").innerHTML =
        stateText[stateData.state];

      var btnRecord = document.querySelectorAll("[data-btn-record]", record);
      btnRecord.forEach(function (btn) {
        btn.style.display = "none";
      });
      switch (stateData.state) {
        case "recording":
          ["pause", "stop"].forEach(function (type) {
            record.querySelector(
              '[data-btn-record="' + type + '"]'
            ).style.display = "inline-block";
          });
          break;
        case "paused":
          ["resume", "stop"].forEach(function (type) {
            record.querySelector(
              '[data-btn-record="' + type + '"]'
            ).style.display = "inline-block";
          });
          break;
        case "stopping":
          break;
        case "inactive":
          ["start"].forEach(function (type) {
            record.querySelector(
              '[data-btn-record="' + type + '"]'
            ).style.display = "inline-block";
          });
          break;
      }
    });

    record.addEventListener("click", function (event) {
      var target = event.target;
      if (target.matches("[data-btn-record]")) {
        var btn = target.getAttribute("data-btn-record");
        var recordOptions;

        switch (btn) {
          case "start":
            recordOptions = {
              maxWidth: window.screen.width,
              maxHeight: window.screen.height,
              //maxFrameRate: 20,
            };
          case "resume":
          case "pause":
          case "stop":
            GM.Record.changeState(btn, recordOptions)
              .then(function (result) {
                console.log("# btn - record state change :", result || btn);
              })
              .catch(function (e) {
                switch (e) {
                  case "permission-activeTab":
                    alert("우측상단 구루미 버튼을 눌러 녹화를 시작해주세요.");
                    break;
                  case "get-audio-input-error":
                    alert(
                      "오디오 설정이 되지 않았습니다. 설정페이지에서 설정 후 다시 시도해주세요."
                    );
                    GM.Record.openDeviceOptionsPage();
                    break;
                  default:
                    console.error("record changeState error", e);
                    break;
                }
              });
            break;
        }
      }
    });

    var clientRecorder;
    var record = document.querySelector(".client-record-controls");

    record.addEventListener("click", function (event) {
      var target = event.target;
      if (target.matches("[data-btn-record]")) {
        var btn = target.getAttribute("data-btn-record");
        switch (btn) {
          case "start":
            GM.Record.clientRecord({
              video: { width: 640, height: 360 },
            }).then((recorder) => {
              clientRecorder = window.clientRecorder = recorder;
              console.log("client record started");
            });
            break;
          case "resume":
          case "pause":
          case "stop":
            clientRecorder.stop().then(() => {
              clientRecorder = null;
            });
            break;
          default:
            break;
        }
      }
    });

    var videoLayouts = document.querySelector(".video-layouts");
    videoLayouts.addEventListener("change", function (event) {
      var target = event.target;
      if (target.matches(".layoutTypes")) {
        const videoLayoutType = target.options[target.selectedIndex].value;
        GM.Call.changeMixingLayout(videoLayoutType);
      }
    });

    var room = document.querySelector(".room");
    var videos = document.querySelector(".videos");
    var main = document.querySelector(".video-main");
    var userControl = document.querySelector(".userControl");
    var videoLayers = document.querySelectorAll(".video-layer");

    var videoLayers = document.querySelectorAll(
      ".video-layer:not([data-mixing-video])"
    );

    room.addEventListener("click", function (e) {
      if (videos.getAttribute("data-calltype") === "mixing") {
        return;
      }

      for (var i = 0; i < videoLayers.length; i++) {
        if (videoLayers[i] === e.target) {
          var clickedVideo = videoLayers[i];
          var oldVideo = main.querySelector(".video-layer");
          var isMain = main.contains(clickedVideo);

          if (isMain) {
            videos.appendChild(clickedVideo);
            return;
          }

          videos.appendChild(oldVideo);
          main.appendChild(clickedVideo);
          break;
        }
      }

      var videosToPlay = document.querySelectorAll(".video-layer video");
      for (var i = 0; i < videosToPlay.length; i++) {
        try {
          videosToPlay[i].play();
        } catch (e) {}
      }
    });

    for (var i = 0; i < videoLayers.length; i++) {
      videoLayers[i].addEventListener("changeUserInfo", function (e) {
        var videoLayer = e.target;
        var roomUser = GM.getRoomUser(videoLayer.getAttribute("userid"));

        var desc = "";
        if (roomUser) {
          desc =
            roomUser.nickname +
            " / " +
            "roleId:" +
            roomUser.roomUserRole.roleId +
            ",camera:" +
            roomUser.cameraStatus +
            ",mic:" +
            roomUser.micStatus +
            ",draw:" +
            roomUser.roomUserRole.draw;
        } else {
          videoLayer.querySelector("video").style.display = "none";
        }

        videoLayer.querySelector(".desc").textContent = desc;
      });
    }

    room.addEventListener("click", function (e) {
      if (e.target.classList.contains("desc")) {
        e.stopPropagation();

        var userId = e.target.closest(".video-layer").getAttribute("userid");
        var roomUser = GM.getRoomUser(userId);

        var roleIdInput = userControl.querySelector(".roleId");
        roleIdInput.value = roomUser.roomUserRole.roleId;

        ["camera", "mic", "draw"].forEach(function (func) {
          var funcButton = userControl.querySelector(
            '[data-role-function="' + func + '"]'
          );
          funcButton.setAttribute("data-enable", roomUser.roomUserRole[func]);
        });

        ["camera", "mic"].forEach(function (device) {
          var deviceButton = userControl.querySelector(
            '[data-device="' + device + '"]'
          );
          deviceButton.setAttribute("data-status", roomUser[device + "Status"]);
        });

        userControl.removeEventListener(".uc");
        userControl.addEventListener("click.uc", function (e) {
          var button = e.target.getAttribute("data-btn");
          switch (button) {
            case "close":
              userControl.close();
              break;
            case "kick":
              GM.kickUser(userId);
              userControl.close();
              break;
          }
        });
        userControl.addEventListener("change.uc", function (e) {
          GM.changeUserRole(userId, e.target.value);
        });
        userControl.addEventListener("click.uc", function (e) {
          var roleFunction = e.target.getAttribute("data-role-function");
          var enable = e.target.getAttribute("data-enable") != "true";
          e.target.setAttribute("data-enable", enable);

          GM.changeUserRoleFunction(userId, roleFunction, enable);
        });
        userControl.addEventListener("click.uc", function (e) {
          var device = e.target.getAttribute("data-device");
          var status = e.target.getAttribute("data-status");

          if (status === "none") return;
          status = status === "on" ? "off" : "on";

          e.target.setAttribute("data-status", status);

          GM.changeUserDeviceStatus(userId, device, status);
        });

        userControl.showModal();
      }
    });

    ///
  }
});

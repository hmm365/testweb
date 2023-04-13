document.addEventListener("DOMContentLoaded", function () {
  var GM = new GooroomeeMeeting({
    //		serviceServerUrl: 'test.gooroomee.com',
    serviceServerUrl: "https://biz.gooroomee.com",
    //		serviceServerUrl: 'gooroomee.com',
    settings: {
      bandWidth: {
        video: (function () {
          // TODO mobile ?
          return {
            // send: 512,
            // receive: 512
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
    $(".otp")
      .on("focus", function () {
        this.select();
      })
      .focus()
      .select();

    // otp join
    $("#btn-join")
      .on("click", function () {
        // get otp from server
        var otp = $(".otp").val().trim();
        if (!otp) return;

        var options = {
          otp: otp,
          camera: "off",
          mic: "on",
          reqInfoList: ["roomUser", "roomDoc"],
        };

        var successCallback = function (info, me) {
          console.log("joinComplete :", info, me);

          setRoomInfo(info);
        };

        var errorCallback = function (errorCode, data) {
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
              var joinableTime = new Date(data.joinableTime);
              alert(
                "미팅룸이 시작되지 않음.\r\n입장가능시간 : " + joinableTime
              );
              break;
            case "room_password_not_matched":
              alert("비밀번호가 일치하지 않습니다.");
            case "room_password_required":
              var passwd = window.prompt("비밀번호 입력");
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
      })
      .click();

    // room mode
    $('[name="roomMode"]').on("click", function () {
      var mode = $('[name="roomMode"]:checked').val();
      GM.changeRoomMode(mode);
    });

    // change device
    $(".device-list-video, .device-list-audio").on("change", function () {
      GM.changeInputDevice(
        $(".device-list-video").val(),
        $(".device-list-audio").val()
      );
    });

    // device on/off
    $(".device-controls").on("click", ".btn-control", function (e) {
      var user = GM.getRoomUser("me"),
        deviceType = this.getAttribute("data-type"),
        deviceStatus = user[deviceType + "Status"];

      if (deviceStatus === "none") {
        return;
      }

      GM.changeDeviceStatus(deviceType, deviceStatus === "on" ? "off" : "on");
    });

    $(".camera-control").on("change", ".cons", function (e) {
      GM.applyLocalVideoTrackConstraints({
        [this.dataset.type]: this.value,
      });
    });

    $(".video-layouts").on("change", ".layoutTypes", function (e) {
      const videoLayoutType = $(this).find("option:selected").val();
      GM.Call.changeMixingLayout(videoLayoutType);
    });

    var $room = $(".room")
      .on("click", ".video-layer:not([data-mixing-video])", function (e) {
        var $videos = $(".videos");
        if ($videos.attr("data-calltype") === "mixing") {
          return;
        }

        var $this = $(e.currentTarget);
        var $main = $(".video-main");
        var $old = $main.find(".video-layer");

        try {
          var isMain = $main[0].contains(this);
          if (isMain) {
            $videos.append($this);
            return;
          }

          $old.appendTo($videos);
          $this.appendTo($main);
        } finally {
          $.merge($old, $this)
            .find("video")
            .each(function () {
              try {
                this.play();
              } catch (e) {}
            });
        }
      })
      .on("changeUserInfo", ".video-layer", function (e) {
        var $videoLayer = $(e.target);
        var roomUser = GM.getRoomUser($videoLayer.attr("userid"));

        var desc = "";
        if (roomUser) {
          desc =
            "" +
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
          $videoLayer.find("video").hide();
        }

        $videoLayer.find(".desc").text(desc);
      })
      .on("click", ".video-layer .desc", function (e) {
        e.stopPropagation();

        var userId = $(e.target).closest(".video-layer").attr("userid");
        var roomUser = GM.getRoomUser(userId);

        var $uc = $(".userControl");

        // roleId
        $uc.find(".roleId").val(roomUser.roomUserRole.roleId);

        // roleFunction
        ["camera", "mic", "draw"].forEach(function (func) {
          $uc
            .find('[data-role-function="' + func + '"]')
            .attr("data-enable", roomUser.roomUserRole[func]);
        });

        // device status
        ["camera", "mic"].forEach(function (device) {
          $uc
            .find('[data-device="' + device + '"]')
            .attr("data-status", roomUser[device + "Status"]);
        });

        $uc
          .off(".uc")
          .one("click.uc", "[data-btn]", function () {
            var btn = this.getAttribute("data-btn");
            switch (btn) {
              case "close":
                $uc[0].close();
                break;
              case "kick":
                GM.kickUser(userId);
                $uc[0].close();
                break;
            }
          })
          .on("change.uc", ".roleId", function (e) {
            GM.changeUserRole(userId, e.target.value);
          })
          .on("click.uc", "[data-role-function]", function (e) {
            var roleFunction = e.target.getAttribute("data-role-function");
            var enable = e.target.getAttribute("data-enable") != "true";
            e.target.setAttribute("data-enable", enable);

            GM.changeUserRoleFunction(userId, roleFunction, enable);
          })
          .on("click.uc", "[data-device]", function (e) {
            var device = e.target.getAttribute("data-device");
            var status = e.target.getAttribute("data-status");

            if (status === "none") return;
            status = status === "on" ? "off" : "on";

            e.target.setAttribute("data-status", status);

            GM.changeUserDeviceStatus(userId, device, status);
          });

        $uc[0].showModal();
      });

    // mixing video
    var videoDragSelector = ".video-layer[data-mixing-video]";
    $(".video-main", $room)
      .off(".v-drag")
      .on("dragstart.v-drag", videoDragSelector, (e) => {
        var channelSeq = e.target.getAttribute("data-channelseq");
        if (!channelSeq) return;
        var userId = e.target.getAttribute("userid");
        if (!userId) return;

        e = e.originalEvent || e;
        e.stopPropagation();

        e.dataTransfer.dropEffect = "move";
        e.dataTransfer.setData("channel", channelSeq);
        e.dataTransfer.setData("userid", userId);
        e.dataTransfer.setDragImage(new Image(), 0, 0);
      })
      .on("dragover.v-drag", videoDragSelector, (e) => {
        e.preventDefault();
      })
      .on("drop.v-drag", videoDragSelector, (e) => {
        var channelSeq = e.target.getAttribute("data-channelseq");
        if (!channelSeq) return;

        e = e.originalEvent || e;
        e.preventDefault();
        e.stopPropagation();

        const userId = e.dataTransfer.getData("userid");
        if (!userId) return;

        var fromChannel = e.dataTransfer.getData("channel");
        GM.Call.changeMixingVideoChannelByUserId(userId, channelSeq);
        console.log("video move :", fromChannel, channelSeq);
      });

    // device test
    $("#btn-device-test").on("click", async function (e) {
      if ($(".device-test")[0].showModal) {
        $(".device-test")[0].showModal();
      } else {
        $(".device-test").show();
      }

      GM.UserMedia.getDevices().then(function (devices) {
        for (var deviceType in devices) {
          var list = devices[deviceType];

          var $select = $('.device-test select[device="' + deviceType + '"]');
          $select.find("option").remove();

          list.forEach(function (device) {
            $("<option>")
              .text(device.label)
              .attr({
                value: device.id,
              })
              .appendTo($select);
          });

          $select.trigger("change");
        }
      });
    });

    var testStreams = [];
    $(".device-test")
      .on("change", "select[device]", function (e) {
        var deviceType = e.target.getAttribute("device");
        switch (deviceType) {
          case "videoinput":
          case "audioinput":
            break;
          case "audiooutput":
            GM.UserMedia.setMediaSinkId(
              $(".device-test .preview audio")[0],
              this.value
            )
              .then(function (e) {
                console.log("change audiooutput");
              })
              .catch(function (e) {
                console.log("change audiooutput fail", e);
              });
            return;
          default:
            return;
        }

        var el = $('.device-test [data-type="' + deviceType + '"]')[0];
        GM.UserMedia.stopMediaStream(el.srcObject);

        GM.UserMedia.getMediaStream(deviceType, this.value)
          .then(function (stream) {
            console.log("getMediaStream :", stream);

            testStreams.push(stream);
            GM.UserMedia.attachMediaStream(el, stream);

            if (deviceType === "audioinput") {
              var $volume = $(".device-test .audio-volume-level");
              GM.UserMedia.setAudioVolumeListener(stream, function (volume) {
                $volume.animate(
                  {
                    width: volume + "%",
                  },
                  {
                    duration: 100,
                    queue: false,
                    complete: function () {
                      $volume.css("width", "0%");
                    },
                  }
                );
              });
            }
          })
          .catch(function (e) {
            console.error("getMediaStream fail :", e);
          });
      })
      .on("click", ".btn-close", function (e) {
        $(".device-test")[0].close();
        testStreams.forEach(function (stream) {
          GM.UserMedia.stopMediaStream(stream);
        });
        testStreams = [];
      });
  }

  function setRoomInfo(info) {
    // room info
    $(".room-info").html(
      [
        "제목 : " + info.roomTitle,
        "참여인원수 : " + info.currJoinCnt + "/" + info.maxJoinCnt,
      ].join("<br>")
    );

    $('[name="roomMode"][value="' + info.roomMode + '"]').prop("checked", true);

    $(".room").attr("data-calltype", info.roomCallInfo.callType);

    UI.Media.setInfo();
  }

  function getUserVideoLayer(userId) {
    return $('.video-layer[userid="' + userId + '"]');
  }
  function createUserVideoLayer(userId) {
    var $videoLayer = $(
      '<div><span class="desc"></span><div class="volume"></div></div>'
    )
      .addClass("video-layer")
      .attr("userid", userId || null);

    if (!userId) {
      $videoLayer.addClass("empty-user");
    }
    $('<video video-type="user">', {
      autoplay: true,
      //muted: true
    }).appendTo($videoLayer);

    return $videoLayer;
  }
  function getMixingVideoLayer(channelSeq) {
    return $('.video-layer[data-channelseq="' + channelSeq + '"]');
  }
  function changeMixingLayout($mixingVideoLayer) {
    if (!GM.Call.isMixing()) {
      return;
    }

    $mixingVideoLayer = $mixingVideoLayer || $(".mixing-video-layer");
    if ($mixingVideoLayer.length === 0) return;

    let $mixingVideo = $mixingVideoLayer.find('video[video-type="mixing"]');
    if ($mixingVideo[0].videoWidth === 0) {
      return;
    }
    // remove empty user dom
    $mixingVideoLayer.find(".empty-user").remove();

    let rect = GM.Call.getMixingPagingLayoutRect({
      videoWidth: $mixingVideo[0].videoWidth,
      videoHeight: $mixingVideo[0].videoHeight,
      viewWidth: $mixingVideo.width(),
      viewHeight: $mixingVideo.height(),
    });

    if (!rect) {
      return;
    }

    const cid = "" + Date.now();
    function createUserVideoLayers(rectList, parent) {
      rectList.forEach((rect, channelSeq) => {
        let $videoLayer = $(
          '> .video-layer[data-channelseq="' + channelSeq + '"]',
          parent
        );
        let userId = rect.userId;

        if ($videoLayer.length == 0) {
          $videoLayer = createUserVideoLayer(userId);
          $videoLayer.attr("data-mixing-video", "").find("video").remove();
          $videoLayer.appendTo(parent);
        }
        $videoLayer
          .css({
            left: rect.left + "px",
            top: rect.top + "px",
            width: rect.width + "px",
            height: rect.height + "px",
          })
          .attr({
            userid: userId || null,
            "data-channelseq": channelSeq,
            draggable: "true",
            "data-_cid_": cid,
          })
          .trigger("changeUserInfo");
      });
      // video Layer 생성 시간이 다른(이전에 생성한) dom 삭제
      parent.find('.video-layer:not([data-_cid_="' + cid + '"])').remove();
    }

    let rectList = rect.base;
    createUserVideoLayers(rectList, $mixingVideoLayer);

    // 페이지 정보 레이어
    (() => {
      let $pageInfo = $mixingVideoLayer.find("[data-pageinfo]");
      if (!rectList.pageInfo || rectList.pageInfo.totalPageCount <= 1) {
        $pageInfo.remove();
        return;
      }
      // 레이아웃 좌표에 page 정보가 있을 경우 표시
      $pageInfo =
        $pageInfo.length > 0
          ? $pageInfo
          : $(`
                  <div data-pageinfo style="position: absolute; z-index: 1;right: 0px;top: 0px;">
                      <button data-btn-page="-1">◀</button>
                      <span data-page="current">1</span><span>/</span><span data-page="total">2</span>
                      <button data-btn-page="1">▶</button>
                  </div>
              `)
              .appendTo($mixingVideoLayer)
              .on("click", "[data-btn-page]", (e) => {
                let addPage = e.target.getAttribute("data-btn-page");
                GM.Call.moveMixingPage(addPage);
              });

      $pageInfo
        .find('[data-page="current"]')
        .text(rectList.pageInfo.curPageIndex + 1);
      $pageInfo
        .find('[data-page="total"]')
        .text(rectList.pageInfo.totalPageCount);
    })();
  }

  var RoomEvent = {
    preGetUserMedia: function () {
      //alert('장치 사용을 허용해주세요.');
    },
    getUserMediaComplete: function (error) {
      if (error) {
        alert("장치 호출 중 오류 : " + error);
      }
    },
    detectUserDevice: function (devices) {
      // user device object
      console.log("user device :", devices);

      var $video = $(".device-list-video");
      $video.find("option").remove();
      devices.videoinput.forEach(function (video) {
        var $opt = $("<option>")
          .text(video.label)
          .attr({
            value: video.id,
          })
          .appendTo($video);

        if (devices.selected && devices.selected.videoId === video.id) {
          $opt.prop("selected", true);
        }
      });

      var $audio = $(".device-list-audio");
      $audio.find("option").remove();
      devices.audioinput.forEach(function (audio) {
        var $opt = $("<option>")
          .text(audio.label)
          .attr({
            value: audio.id,
          })
          .appendTo($audio);

        if (devices.selected && devices.selected.audioId === audio.id) {
          $opt.prop("selected", true);
        }
      });
    },
    userDeviceChange: function (devices) {
      // user device object
      console.log("user device change :", devices);

      var $video = $(".device-list-video");
      var vId = $video.val();
      $video.find("option").remove();
      devices.videoinput.forEach(function (video) {
        var $opt = $("<option>")
          .text(video.label)
          .attr({
            value: video.id,
          })
          .appendTo($video);
        if (vId == video.id) {
          $opt.attr("selected", "");
        }
      });

      var $audio = $(".device-list-audio");
      var aId = $audio.val();
      devices.audioinput.forEach(function (audio) {
        var $opt = $("<option>")
          .text(audio.label)
          .attr({
            value: audio.id,
          })
          .appendTo($audio);
        if (aId == audio.id) {
          $opt.attr("selected", "");
        }
      });
    },
    notSupportedUserDevice: function () {},
    notAllowedDeviceError: function (error) {
      switch (error) {
        case "noneUserDevice":
          return;
        case "OverconstrainedError":
          console.warn(error);
          alert("장치가 지원하지 않는 설정.");
          break;
        case "NoiseCancelInitError":
          console.warn(error);
          alert("노이즈 캔슬링 초기화 에러");
          break;
        default:
          // notAllowedDeviceError
          console.warn("notAllowedDeviceError", error);
          alert("장치 사용을 거부하셔서 사용할 수 없습니다.");
          break;
      }
    },
    requestClientStream: function ({ params, stream, success, error }) {
      // constrains 무시
      let constraints = {
        audio: true,
        video: {
          width: { min: 320, ideal: 640, max: 1280 },
          height: { min: 180, ideal: 360, max: 720 },
        },
      };

      // 장치 id 만 적용
      if (params.video.deviceId) {
        constraints.video.deviceId = { exact: params.video.deviceId };
      }
      if (params.audio.deviceId) {
        constraints.audio.deviceId = { exact: params.audio.deviceId };
      }

      if (stream) {
        stream.getTracks().forEach((track) => {
          track.stop();
        });
      }

      navigator.mediaDevices
        .getUserMedia(constraints)
        .then(success)
        .catch(error);
    },
    serverDisconnected: function () {
      // disconnected server
      console.warn("server disconnected!!");
    },
    changeRoom: function (user, info) {
      setRoomInfo(info);
    },
    changeCallType: function (user, info) {
      $(".videos")
        .attr("data-calltype", info.roomCallInfo.callType)
        .find(".video-layer")
        .remove();
    },

    changeRoomMode: function (user, roomMode) {
      $('[name="roomMode"][value="' + roomMode + '"]').prop("checked", true);
    },

    joinUser: function (user, date) {
      setRoomInfo(GM.getRoomInfo());

      $(".select-user").each(function () {
        var $this = $(this);
        var opt = $this.find('option[value="' + user.userId + '"]');
        if (opt.length > 0) return;

        $("<option>")
          .text(user.nickname)
          .attr({
            value: user.userId,
          })
          .appendTo(this);
      });
    },
    leaveUser: function (user, reason, date) {
      var isMe = GM.isMe(user);

      switch (reason) {
        case "closeRoom":
          return;
        case "kick":
          break;
        case "duplicateJoin":
          break;
      }

      // remove video
      getUserVideoLayer(user.userId).remove();

      setRoomInfo(GM.getRoomInfo());

      $('.select-user option[value="' + user.userId + '"]').remove();
    },

    changeDeviceStatus: function (user, deviceType, deviceStatus, fromUser) {
      //console.log('# changeDeviceStatus camera[%s], mic[%s]', user.cameraStatus, user.micStatus);
      console.log(
        "# changeDeviceStatus deviceType[%s], deviceStatus[%s], fromUser[%s]",
        deviceType,
        deviceStatus,
        fromUser && user.nickname
      );

      var $videoLayer = getUserVideoLayer(user.userId);

      if ($videoLayer.length == 0) return;

      $videoLayer.trigger("changeUserInfo");
    },
    // my video stream
    addLocalStream: function (stream) {
      let me = GM.getRoomUser("me"),
        $videoLayer = getUserVideoLayer(me.userId);

      if ($videoLayer.length == 0) {
        $videoLayer = $(
          '<div><span class="desc"></span></span><div class="volume"></div></div>'
        )
          .attr("id", "video-" + me.userId)
          .attr("userid", me.userId)
          .addClass("video-layer me");

        let $video = $('<video video-type="user">', {
          autoplay: true,
        });
        $video[0].muted = true;
        $videoLayer.append($video);
        $(".videos").append($videoLayer);
      }

      const video = $videoLayer.find("video")[0];
      if (video) {
        GM.UserMedia.attachMediaStream(video, stream);
        video.play();
      }

      RoomEvent.changeDeviceStatus.call(this, me);
    },
    // room user video stream
    addRemoteStream: function (user, stream) {
      var $videoLayer = getUserVideoLayer(user.userId);

      if ($videoLayer.length == 0) {
        $videoLayer = createUserVideoLayer(user.userId);
        $(".videos").append($videoLayer);
      }

      let video = $videoLayer.find("video")[0];
      let v_parent = video.parentElement;
      let v_c = video.cloneNode(true);
      video.remove();
      video = v_c;
      v_parent.append(video);

      GM.UserMedia.attachMediaStream(video, stream);
      video.play();
      RoomEvent.changeDeviceStatus.call(this, user);
    },

    userConnectionFailed: function (user) {
      console.error("# userConnectionFailed :", user);
    },

    userConnectionDisconnected: function (user) {
      console.log("# userConnectionDisconnected :", user);
    },

    userMicVolume: function (userId, volume) {
      var $videoLayer = getUserVideoLayer(userId);
      if (!$videoLayer || $videoLayer.length === 0) {
        return;
      }

      if (!$videoLayer._v) {
        $videoLayer._v = $videoLayer.find(".volume");
      }

      $videoLayer._v.animate(
        {
          height: volume + "%",
        },
        {
          duration: 100,
          queue: false,
          complete: function () {
            this.style.height = "0%";
          },
        }
      );
    },

    changeUserRole: function (roomUser) {
      getUserVideoLayer(roomUser.userId).trigger("changeUserInfo");
    },
    changeUserRoleFunction: function (roomUser) {
      getUserVideoLayer(roomUser.userId).trigger("changeUserInfo");
    },

    addMixingRemoteStream: function (stream) {
      var $videoMain = $(".video-main");
      var $mixingVideoLayer = $(".mixing-video-layer", $videoMain);

      if ($mixingVideoLayer.length == 0) {
        // p2p, sfu clear
        $(".videos .video-layer").remove();

        $mixingVideoLayer = $(
          '<div><video video-type="mixing" autoplay></video></div>'
        );

        $mixingVideoLayer
          .addClass("mixing-video-layer")
          .attr({
            "video-type": "mixing",
          })
          .find("video")
          .on("resize", (e) => {
            changeMixingLayout();
          });

        $videoMain.append($mixingVideoLayer);
      }

      GM.UserMedia.attachMediaStream(
        $mixingVideoLayer.find("video")[0],
        stream
      );
      $mixingVideoLayer.find("video")[0].play();
    },
    changeMixingLayout: function (layoutType) {
      changeMixingLayout();
      if (layoutType) {
        $(".layoutTypes option:selected").prop("selected", false);
        $(".layoutTypes option[value=" + layoutType + "]").prop(
          "selected",
          true
        );
      }
    },

    // MediaShare
    addShareMediaSource: function (user, mediaSource) {
      UI.Media.addShareMediaSource(user, mediaSource);
    },
    removeShareMediaSource: function (user, mediaSource) {
      UI.Media.removeShareMediaSource(user, mediaSource);
    },
    setMediaInfo: function () {
      UI.Media.setInfo();
    },
  };
});

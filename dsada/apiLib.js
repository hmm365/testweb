document.addEventListener("DOMContentLoaded", function () {
  var UI = {};
  UI.Media = {
    init: function () {
      let THIS = this;

      if (!GM.Media) return;
      GM.Media.init($(".mediashare-view-wrapper")[0]);

      THIS.$mediaLayer = $(".mediashare-layer");
      THIS.$mediaList = THIS.$mediaLayer.find(".mediashare-list");

      // upload
      THIS.$mediaLayer
        .on("click", "#btnUploadMedia", function () {
          $("<input>")
            .attr({
              type: "file",
              accept: ".mp3,.ogg,.mp4,.webm",
            })
            .on("change", function (e) {
              if (this.files.length === 0) return;

              for (let i = 0; i < this.files.length; i++) {
                let file = this.files[0];
                let uploadId =
                  file.name + "@" + file.lastModified + "@" + file.size;
                if ($('[data-uploadid="' + uploadId + '"]').length > 0) {
                  console.warn("already uploading file :", file);
                  continue;
                }

                (function () {
                  let $item = THIS.$mediaList
                    .find(".media-sample.ellipsis[data-upload]")
                    .clone();
                  $item.removeClass("media-sample");
                  $item.attr("data-uploadid", uploadId);
                  $item.find(".title").text(file.name);
                  $item.show();
                  let $progress = $item.find(".progressBar");

                  let abort = false;
                  $item.on("upload-cancel", function (e) {
                    abort = true;
                  });

                  GM.Media.uploadMediaFile(file, {
                    start: function (file) {
                      THIS.$mediaList.prepend($item);
                    },
                    progress: function (file, loaded, total) {
                      if (abort) {
                        this.abort();
                      }

                      let percent = parseInt((loaded / total) * 100);
                      $progress[0].style.width = percent + "%";
                    },
                    error: function (e) {
                      $item.remove();
                      console.error("addShareMediaFile error", e);
                    },
                    complete: function (file) {
                      $item.remove();
                    },
                  });
                })(file);
              }
            })
            .click();
        })
        .on("click", "#btnUploadMediaUrl", function () {
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
        })
        .on("click", ".repeatBtn", function (event) {
          let playType = $(this).data("repeat-type");
          GM.Media.setRoomMediaSharePlayType(playType)
            .then(() => {})
            .catch((e) => {
              console.error(e);
            });
        })
        .on("click", ".ellipsis .btn-del", function (event) {
          event.stopPropagation();
          let $item = $(event.target).closest(".ellipsis");
          let sourceId = $item.attr("data-sourceid");
          if (!sourceId) {
            return;
          }

          if (confirm("삭제하시겠습니까?")) {
            GM.Media.removeShareMediaFile(sourceId);
          }
        });

      // play
      THIS.$mediaList.on("click", "[data-sourceid]", function (e) {
        let dataSourceId = this.getAttribute("data-sourceid");
        if (!dataSourceId) {
          return;
        }
        GM.Media.shareMediaPlayerPlay(0, dataSourceId);
      });
    },
    setInfo: function () {
      let THIS = this;

      if (!GM.Media) return;

      GM.Media.setInfo();

      // play type
      THIS.$mediaLayer.find(".repeatBtn").attr({ "data-active": false });
      THIS.$mediaLayer
        .find(`.repeatBtn[data-repeat-type="${GM.Media.getPlayType()}"]`)
        .attr({
          "data-active": true,
        });

      let mediaSource = GM.Media.getCurrentShareMediaSource();
      if (!mediaSource) {
        return;
      }
      // play title
      THIS.$mediaLayer.find(".titleRec").text(mediaSource.filename);
    },
    addShareMediaSource: function (user, mediaSource) {
      let THIS = this;
      let $item = THIS.$mediaList
        .find(".media-sample.ellipsis[data-upload]")
        .clone();
      $item.removeClass("media-sample");
      $item.attr({
        "data-sourceid": mediaSource.sourceId,
        title: mediaSource.filename.replace(/</g, "&lt;").replace(/>/g, "&gt;"),
        "data-upload": "complete",
        "data-type": mediaSource.dataType,
        src: mediaSource.dataType === "url" ? mediaSource.contents : "",
      });
      $item.find(".title").text(mediaSource.filename);

      let ct = mediaSource.duration;
      let mm = THIS.lpad("" + parseInt(ct / 60), 2, "0");
      let ss = THIS.lpad("" + parseInt(ct % 60), 2, "0");
      $item.find(".fileInfo").text(mm + ":" + ss);

      $item.show();
      THIS.$mediaList.append($item);
    },
    removeShareMediaSource: function (user, mediaSource) {
      let THIS = this;

      let $item = THIS.$mediaList.find(
        `[data-sourceid="${mediaSource.sourceId}"]`
      );
      $item && $item.remove();
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

        var audioOnly = $("#chkAudioOnly").prop("checked");

        var options = {
          otp: otp,
          camera: audioOnly ? "off" : "on",
          mic: "on",
          reqInfoList: ["roomUser", "roomDoc"],
        };

        var successCallback = function (info, me) {
          console.log("joinComplete :", info, me);

          setRoomInfo(info);

          // room user list
          info.roomUserList.forEach(function (user) {
            if (user.userId == me.userId) return;

            var $otp = $("<option>").text(user.nickname).attr({
              value: user.userId,
            });
            $(".select-user").each(function () {
              $otp.clone().appendTo(this);
            });
          });

          // room doc list
          var addRoomDoc = RoomEvent.addRoomDoc.bind(this);
          var setRoomDocPage = RoomEvent.setRoomDocPage.bind(this);
          info.roomDocInfo.roomDocList.forEach(function (roomDoc) {
            addRoomDoc(null, roomDoc);
            if (roomDoc.docId == info.roomDocInfo.docId) {
              setRoomDocPage(null, roomDoc);
            }
          });

          $(window).on("resize orientationchange", function (e) {
            changeMixingLayout();
          });
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

        // Gooroomee Document init
        GM.Document.init(".doc-view", {
          useWheel: true,
          maxZoom: 5,
        });
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
    $(".device-controls")
      .on("click", ".btn-screen-capture", function (e) {
        var format = "jpg";
        GM.captureScreen({
          format: format,
          quality: 90,
        }).then(function (result) {
          var $view = $(".preview-screen-capture");
          $view.off(".psc").on("click.psc", "[data-btn]", function (e) {
            var btn = this.getAttribute("data-btn");
            switch (btn) {
              case "close":
                $view[0].close();
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
                $view[0].close();
                var $status = $(".upload-doc-status");
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
                    $status.text("전송 시작 : " + file.name);
                  },
                  progress: function (file, loaded, total) {
                    var percent = parseInt(100 * (loaded / total));
                    $status.text("전송 : " + file.name + ", " + percent + "%");
                  },
                  complete: function () {},
                });
                break;
            }
          });

          var src = URL.createObjectURL(result.blob);

          $view
            .find(".preview img")
            .on("load", function () {
              URL.revokeObjectURL(this.src);
            })
            .attr("src", src);

          $view[0].showModal();
        });
      })
      .on("click", ".btn-screen", function (e) {
        var me = GM.getRoomUser("me"),
          $videoLayer = getUserVideoLayer(me.userId);

        if (GM.isScreenShare()) {
          $videoLayer.find('video[video-type="screen"]').remove();
          $videoLayer
            .find('video:not([video-type="screen"])')
            .show()
            .each(function () {
              this.play();
            });

          GM.stopScreenShare();
        } else {
          GM.startScreenShare(["screen", "window", "audio"], 10)
            .then(function (stream) {
              var $screen = $videoLayer.find('video[video-type="screen"]');
              if ($screen.length === 0) {
                $screen = $("<video>", {
                  "video-type": "screen",
                  autoplay: true,
                }).appendTo($videoLayer);
                $screen[0].muted = true;

                GM.UserMedia.attachMediaStream($screen[0], stream);
                $screen[0].play();
              }
              $videoLayer.find('video:not([video-type="screen"])').hide();
            })
            .catch(function (e) {
              console.error("start screen share error :", e);
              switch (e) {
                case "not-installed": // 미설치
                  var $dialog = $(".install-grm-extension");
                  $dialog
                    .on("click", ".install", function (e) {
                      window.open(
                        GM.getGooroomeeExtensionInstallUrl(),
                        "_grm_ext_install"
                      );
                      $dialog[0].close();
                    })
                    .on("click", ".close", function (e) {
                      $dialog[0].close();
                    });
                  $dialog[0].showModal();
                  break;
              }
            });
        }
      })
      .on("click", ".btn-control", function (e) {
        var user = GM.getRoomUser("me"),
          deviceType = this.getAttribute("data-type"),
          deviceStatus = user[deviceType + "Status"];

        if (deviceStatus === "none") {
          return;
        }

        GM.changeDeviceStatus(deviceType, deviceStatus === "on" ? "off" : "on");
      })
      .on(
        "click",
        '.noise-cancel-control[data-type="noise-cancel"]',
        function (e) {
          GM.toggleNoiseCancel();
        }
      )
      .on(
        "click",
        '.noise-cancel-control[data-type="noise-cancel-on"]',
        function (e) {
          GM.startNoiseCancel();
        }
      )
      .on(
        "click",
        '.noise-cancel-control[data-type="noise-cancel-off"]',
        function (e) {
          GM.stopNoiseCancel();
        }
      )
      .on(
        "click",
        '.noise-cancel-control[data-type="noise-cancel-status"]',
        function (e) {
          let noiseCancelStatus = GM.getNoiseCancelStatus();
          alert(`노이즈 캔슬 ${noiseCancelStatus ? "ON" : "OFF"}`);
        }
      );

    $(".camera-control").on("change", ".cons", function (e) {
      GM.applyLocalVideoTrackConstraints({
        [this.dataset.type]: this.value,
      });
    });

    var $recordTime = $(".record-controls .record-time");
    var _recordingTimer;
    function recordTimer(stateData) {
      window.clearTimeout(_recordingTimer);

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
      $recordTime.html(time);

      switch (stateData.state) {
        case "recording":
          stateData.recordingTime += 1000;
          _recordingTimer = window.setTimeout(recordTimer, 1000, stateData);
          break;
        case "paused":
          break;
        case "stopping":
        case "inactive":
          $recordTime.html("");
          break;
      }
    }
    var $record = $(".record-controls")
      .on("change-state", function (e) {
        var stateData = e.stateData;
        recordTimer(stateData);

        var stateText = {
          recording: "녹화중",
          paused: "녹화일시정지",
          stopping: "녹화정지중",
          inactive: "녹화정지",
        };
        $record.find(".record-state").html(stateText[stateData.state]);

        $("[data-btn-record]", $record).hide();
        switch (stateData.state) {
          case "recording":
            ["pause", "stop"].forEach(function (type) {
              $('[data-btn-record="' + type + '"]', $record).show();
            });
            break;
          case "paused":
            ["resume", "stop"].forEach(function (type) {
              $('[data-btn-record="' + type + '"]', $record).show();
            });
            break;
          case "stopping":
            break;
          case "inactive":
            ["start"].forEach(function (type) {
              $('[data-btn-record="' + type + '"]', $record).show();
            });
            break;
        }
      })
      .on("click", "[data-btn-record]", function (e) {
        var btn = this.getAttribute("data-btn-record");
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
      });

    var clientRecorder;
    var $record = $(".client-record-controls")
      .on("change-state", function (e) {})
      .on("click", "[data-btn-record]", function (e) {
        var btn = this.getAttribute("data-btn-record");
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

    // doc upload
    $("#btnUploadDocFiles").on("click", function () {
      $("<input>")
        .attr({
          type: "file",
          multiple: "multiple",
          accept: "image/*,.pdf,.xls,.xlsx,.ppt,.pptx,.doc,.docx,.hwp",
        })
        .on("change", function () {
          uploadDocFiles(this.files);
        })
        .click();
    });
    $("#btnUploadDocFilesFromUrl").on("click", function () {
      var url = window.prompt("공유자료 url 입력. cors 설정 필수!").trim();
      if (!url) return;

      var xhr = new XMLHttpRequest();
      xhr.open("GET", url, true);
      xhr.responseType = "blob";
      xhr.addEventListener("load", function () {
        if (xhr.status !== 200) {
          if (xhr.readyState === 4) {
            console.log("Error", xhr.statusText);
          }
          return;
        }

        console.log(xhr, xhr.getAllResponseHeaders());
        var type = xhr.getResponseHeader("Content-Type");
        var filename = (function () {
          var fn;
          var disposition = xhr.getResponseHeader("Content-Disposition");
          if (disposition && disposition.indexOf("attachment") !== -1) {
            var filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
            var matches = filenameRegex.exec(disposition);
            if (matches != null && matches[1]) {
              fn = matches[1].replace(/['"]/g, "");
            }
          }
          if (!fn) {
            fn = url.substring(url.lastIndexOf("/") + 1);
          }
          return fn;
        })();
        console.log("filename[%s], type[%s] :", filename, type);

        var blob = xhr.response;
        // * original filename
        blob.name = filename;
        console.log("blob :", blob);

        uploadDocFiles(blob);
      });
      xhr.addEventListener("error", function (e) {
        console.log("error :", xhr, xhr.response, xhr.statusText);
      });
      xhr.send();
    });
    function uploadDocFiles(files) {
      var $status = $(".upload-doc-status");

      // upload action
      GM.Document.upload(files, {
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
          $status.text("전송 시작 : " + file.name);
        },
        progress: function (file, loaded, total) {
          var percent = parseInt(100 * (loaded / total));
          $status.text("전송 : " + file.name + ", " + percent + "%");
        },
        complete: function () {},
      });
    }

    // doc page download
    $(".btn-doc-download").on("click", function (e) {
      var type = this.getAttribute("data-type");
      var docId = e._docId;
      var docPageSeq = e._docPageSeq;

      let selfSelectedDoc = $(".doc-list ol li.self-selected");
      let selectedDoc =
        selfSelectedDoc.length > 0
          ? selfSelectedDoc
          : $(".doc-list ol li.selected");
      let childList =
        selectedDoc.find("ol").length > 0 ? selectedDoc.find("ol") : null;

      if (childList == null) {
        docId = selectedDoc[0].getAttribute("data-docid");
        docPageSeq = 1;
      } else {
        let selfSelectEl = childList.find("li.self-selected");
        let selectEl =
          selfSelectEl.length > 0
            ? selfSelectEl
            : childList.find("li.selected");
        docId = selectEl[0] && selectEl[0].getAttribute("data-docid");
        docPageSeq = selectEl[0] && selectEl[0].getAttribute("data-pageseq");
      }

      if (type === "pdf") {
        docId = docId || GM.getRoomInfo().roomDocInfo.docId;

        var st = Date.now();
        console.log("# pdf save start :", docId);

        var $status = $(".doc-to-pdf-status");
        GM.Document.createRoomDocPdf(docId, {
          startPage: 1,
          endPage: null,
          progress: function (percent) {
            $status.text(percent + "%");
          },
        })
          .then(function (result) {
            console.log(
              "# pdf save end : %s, %dms",
              docId,
              Date.now() - st,
              result
            );
            var url = URL.createObjectURL(result.blob);
            try {
              var a = document.createElement("a");
              a.href = url;
              a.download = result.filename;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
            } finally {
              URL.revokeObjectURL(url);
            }
          })
          .catch(function (e) {
            console.error("# pdf save error : %s", docId, e);
          });
      } else {
        GM.Document.createRoomDocPageImage(docId, docPageSeq, {
          format: "jpg",
          quality: 100,
        })
          .then(function (result) {
            var url = URL.createObjectURL(result.blob);
            try {
              var a = document.createElement("a");
              a.href = url;
              a.download = result.filename;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
            } finally {
              URL.revokeObjectURL(url);
            }
          })
          .catch(function (e) {
            console.error("doc download error", e);
          });
      }
    });

    // doc
    // set current room doc page
    $(".doc-list")
      .on("click", '[data-type="doc"] [data-btn="del"]', function (e) {
        e.stopPropagation();

        var docId = $(this).closest('[data-type="doc"]').attr("data-docId");
        if (!docId) return;
        if (!confirm("삭제하시겠습니까?")) {
          return;
        }

        GM.Document.removeRoomDoc(docId);
      })
      .on("contextmenu", 'li[data-type="docPage"] img', function (e) {
        e.preventDefault();

        var $this = $(this);
        var $doc = $this.closest("[data-docid]");

        var $el = $("<div>")
          .css({
            position: "absolute",
            left: "0",
            top: "0",
            "z-index": "1",
            width: "100%",
            height: "100%",
            "background-color": "rgba(204, 204, 204, 0.5)",
            "font-size": "9px",
          })
          .attr("tabindex", "-1")
          .append('<button data-btn-type="img">IMG저장</button>')
          .append('<button data-btn-type="pdf">PDF저장</button>')
          .on("click", "[data-btn-type]", function (e) {
            var type = this.getAttribute("data-btn-type");
            $('.btn-doc-download[data-type="' + type + '"]').trigger({
              type: "click",
              _docId: $doc.attr("data-docId"),
              _docPageSeq: $doc.attr("data-pageSeq"),
            });
            $el.remove();
          })
          .on("blur", function () {
            var THIS = this;
            setTimeout(function () {
              THIS.remove();
            }, 300);
          })
          .appendTo(this.parentElement)
          .focus();
      })
      .on("click", "li[data-docid] img", function (e) {
        e.stopPropagation();

        var $this = $(this);
        var $doc = $this.closest("[data-docid]");

        var type = $doc.attr("data-type"),
          docId = $doc.attr("data-docId"),
          pageSeq = $doc.attr("data-pageSeq"),
          roomDoc = GM.Document.getRoomDoc(docId);

        var self = $(".doc-self-mode").prop("checked");

        if (type === "doc") {
          // doc selected
          GM.Document.setRoomDocPage(docId, null, self);
        } else {
          // doc child page selected
          GM.Document.setRoomDocPage(docId, pageSeq, self);
        }
      });

    // doc tool
    $(".btn-doc-tool").on("click", function (e) {
      var type = this.getAttribute("data-type");
      switch (type) {
        case "EraseAll":
          GM.Document.clearDraws();
          break;
        case "Text":
          $(".doc-layer .select-font-size").trigger("change");
        default:
          GM.Document.changeToolKit(type);
          break;
      }
    });
    // doc tool stroke color
    $(".btn-color").on("click", function (e) {
      var color = this.getAttribute("data-color");
      GM.Document.setToolkitStyle({
        strokeColor: color,
      });
    });
    // doc tool stroke width
    $(".doc-layer")
      .on("change", ".select-stroke-width", function (e) {
        GM.Document.setToolkitStyle({
          strokeWidth: this.value,
        });
      })
      .on(
        "change",
        ".select-font-size, .select-font-family, .font-bold, .font-italic",
        function (e) {
          var bold = $(".doc-layer .font-bold").prop("checked");
          var italic = $(".doc-layer .font-italic").prop("checked");
          var size = $(".doc-layer .select-font-size").val();
          var type = $(".doc-layer .select-font-family").val();

          var font = size + "em " + type;
          if (bold) {
            font = "bold " + font;
          }
          if (italic) {
            font = "italic " + font;
          }
          console.log("change font-style :", font);
          GM.Document.setToolkitStyle({
            font: font,
          });
        }
      );

    // doc canvas zoom
    $(".btn-zoom").on("click", function (e) {
      var type = this.getAttribute("data-type"),
        zoom;
      switch (type) {
        case "zoomIn":
          zoom = 0.2;
          break;
        case "zoomOut":
          zoom = -0.2;
          break;
        case "zoomFit":
          zoom = "fit";
          break;
        case "zoomOri":
          zoom = "ori";
          break;
      }
      GM.Document.zoom(zoom);
    });

    // chat
    $(".chat-inp")
      .on("change", ".select-user", function (e) {
        $(".chat-inp .inp-chat-msg").focus();
      })
      .on("keyup", ".inp-chat-msg", function (e) {
        if (e.keyCode !== 13) {
          return;
        }
        $(".chat-inp .btn-send-chat").click();
      })
      .on("click", ".btn-send-chat", function (e) {
        var $msg = $(".chat-inp .inp-chat-msg");
        var userId = $(".chat-inp .select-user").val();

        var text = $msg.val().trim();
        if (!text) return;

        var data = {
          text: text,
        };
        if (userId) {
          data.toUserId = userId;
        }

        GM.sendChat(data);
        $msg.val("").focus();
      });

    // device test
    $("#btn-device-test").on("click", function (e) {
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

    // media share
    UI.Media.init();
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
    roomChatMsg: function (user, roomChatMsg, date) {
      console.log("# roomChatMsg", user, roomChatMsg, date);

      var $list = $(".chat-msg-list");
      $("<li>")
        .text(user.nickname + " : " + roomChatMsg.text)
        .addClass("chat-msg")
        .attr("data-whisper", roomChatMsg.whisper)
        .appendTo($list);
      $list.parent().scrollTop(999999);
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
      try {
        const caps = GM.getLocalVideoTrackCapabilities(stream);
        $(".camera-control .cons").each((i, el) => {
          const val = caps[el.dataset.type];
          if (val) {
            el.disabled = false;
            el.max = val.max;
            el.min = val.min;
            el.step = val.step;
          } else el.disabled = true;
        });

        const settings = GM.getLocalVideoTrackSettings(stream);
        $(".camera-control .cons").each((i, el) => {
          if (settings[el.dataset.type]) {
            el.value = settings[el.dataset.type];
          }
        });
      } catch (e) {
        console.warn(e);
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
    addRemoteScreenShareStream: function (user, stream) {
      $videoLayer = getUserVideoLayer(user.userId);
      var $screen = $videoLayer.find('video[video-type="screen"]');
      if ($screen.length === 0) {
        $screen = $("<video>")
          .attr("video-type", "screen")
          .appendTo($videoLayer);

        GM.UserMedia.attachMediaStream($screen[0], stream);
        $screen[0].play();
      }

      $videoLayer.find('video:not([video-type="screen"])').hide();

      if (!GM.Call.isMixing()) {
        return;
      }
      // secondStream video 생성
      GM.setMixerUserSecondaryVideoWithPrimary().then((stream) => {
        let $secondaryVideoLayer = $(".second-video-layer");
        let $secondVideo = $secondaryVideoLayer.find("#second-video");
        if ($secondVideo.length == 0) {
          $('<video id="second-video" autoplay playsinline>', {}).appendTo(
            $secondaryVideoLayer
          );
        }
        $("#second-video")[0].srcObject = stream;
      });
    },
    removeRemoteScreenShareStream: function (user) {
      $videoLayer = getUserVideoLayer(user.userId);
      $videoLayer.find('video[video-type="screen"]').remove();
      $videoLayer
        .find('video:not([video-type="screen"])')
        .show()
        .each(function () {
          this.play();
        });

      if (!GM.Call.isMixing()) {
        return;
      }
      // secondStream video 삭제
      const $secondaryVideo = $("#second-video")[0];
      if ($secondaryVideo) {
        $secondaryVideo.remove();
      }
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
    changeClientRecordState: function (roomUser, stateData) {
      $(".record-controls").trigger({
        type: "change-state",
        stateData: stateData,
      });
    },
    addRoomDoc: function (user, roomDoc) {
      console.log("# addRoomDoc", user, roomDoc);

      var $docItem = $(
        '.doc-list [data-type="doc"][data-docId="' + roomDoc.docId + '"]'
      ).first();

      if ($docItem.length == 0) {
        var $docItem = $("<li>")
          .attr({
            "data-type": "doc",
            "data-docId": roomDoc.docId,
          })
          .append($('<span class="doc-name">'))
          .append($('<span data-btn="del">X</span>'))
          .append($('<span class="img-thumb"></span>'));

        $(".doc-list ol").first().append($docItem);
      }

      var filename = roomDoc.filename;

      // TODO lazyload
      var setThumb = function ($docItem, roomDoc) {
        if (roomDoc.filePageCnt == 0) {
          return;
        }

        if ($docItem.attr("thumb")) {
          return;
        }

        $docItem.attr("thumb", true);
        GM.Document.getRoomDocThumbnailImage(roomDoc.docId, 1)
          .then(function (img) {
            $docItem.find(".img-thumb").append(img);
          })
          .catch(function (e) {
            console.error(
              "GM.Document.getRoomDocThumbnailImage err :",
              e,
              roomDoc.docId,
              1
            );
            $docItem.attr("thumb", false);
          });
      }.bind(this, $docItem, roomDoc);

      switch (roomDoc.docConvertStats) {
        case "start":
          if (roomDoc.docConvertCnt > 0) {
            setThumb();
          }

          filename +=
            " 변환중:" +
            (roomDoc.filePageCnt == 0
              ? ""
              : roomDoc.docConvertCnt + "/" + roomDoc.filePageCnt);
          break;
        case "fail":
          filename +=
            " failed" + roomDoc.docConvertCnt + "/" + roomDoc.filePageCnt;
          break;
        case "success":
          setThumb();
        default:
          setThumb();

          filename +=
            roomDoc.filePageCnt > 1
              ? " (" + roomDoc.currDocPageSeq + "/" + roomDoc.filePageCnt + ")"
              : "";
          break;
      }

      $docItem.find(".doc-name").text(filename);
    },
    addRoomDocConvertFail: function (user, roomDoc) {
      RoomEvent.addRoomDoc.call(this, user, roomDoc);
    },
    addRoomDocConvertComplete: function (user, roomDoc) {
      RoomEvent.addRoomDoc.call(this, user, roomDoc);
    },
    addRoomDocPage: function (user, roomDoc, roomDocPage) {
      RoomEvent.addRoomDoc.call(this, user, roomDoc);
    },
    removeRoomDoc: function (user, roomDoc) {
      $('.doc-list [data-docId="' + roomDoc.docId + '"]')
        .first()
        .remove();
    },
    setRoomDocPage: function (user, roomDoc, self) {
      var className = (self ? "self-" : "") + "selected";
      $(".doc-list li." + className).removeClass(className);

      var $docItem = $(
        '.doc-list [data-docId="' + roomDoc.docId + '"]'
      ).first();

      // add child pages
      if (
        !$docItem.data("add-child") &&
        roomDoc.docPageList &&
        roomDoc.docPageList.length > 1
      ) {
        var $docPages = $("<ol>");
        roomDoc.docPageList.forEach(function (docPage, i) {
          // TODO lazyload
          if (!docPage.docPageSeq || docPage.docPageSeq <= 0) {
            return;
          }

          (function (docPage) {
            var $docPageItem = $("<li>")
              .attr({
                "data-type": "docPage",
                "data-docId": docPage.docId,
                "data-pageSeq": docPage.docPageSeq,
              })
              .append($("<span>").text("page " + (i + 1)));

            $docPages.append($docPageItem);

            GM.Document.getRoomDocThumbnailImage(
              docPage.docId,
              docPage.docPageSeq
            )
              .then(function (img) {
                //console.log('load thumbnail img :', docPage.docId, docPage.docPageSeq);
                $docPageItem.append(
                  $('<span class="img-thumb"></span>').append(img)
                );
              })
              .catch(function (e) {
                console.error(
                  "GM.Document.getRoomDocThumbnailImage err :",
                  e,
                  docPage.docId,
                  docPage.docPageSeq
                );
              });
          })(docPage);
        });

        $docItem.append($docPages);
        $docItem.data("add-child", true);
      }

      // selected
      $docItem.addClass(className);
      $docItem
        .find('[data-pageSeq="' + roomDoc.currDocPageSeq + '"]')
        .addClass(className);

      // change title
      RoomEvent.addRoomDoc.call(this, user, roomDoc);
    },
    drawRoomDocPageImage: function (roomDocPage, imgWidth, imgHeight) {
      console.log("# drawRoomDocPageImage", roomDocPage, imgWidth, imgHeight);
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
    recordFileSaved: function (record) {
      //if(true) return;

      var startTime = Date.now();
      var $p = $(".record-download-progress");
      var filename =
        "grm_rec_" + gm.getRoomUser("me").nickname + "_" + Date.now();
      GM.Record.downloadRecordFile(record.recordId, filename, {
        progress: function (bytesReceived) {
          try {
            var filesize = record.filesize;
            var remainBytes = filesize - bytesReceived;
            var remainTime =
              (remainBytes * (Date.now() - startTime)) /
              (filesize - remainBytes);
            remainTime = remainTime / 1000;

            var percent = parseInt((bytesReceived / filesize) * 100);

            var h = parseInt(remainTime / 3600);
            var m = parseInt((remainTime / 60) % 60);
            var s = parseInt(remainTime % 60);
            var timeStr =
              (h > 0 ? h + "시간" : "") +
              (m > 0 ? " " + m + "분" : "") +
              (" " + s + "초");

            $p.text(percent + "% " + timeStr);

            if (percent >= 100) {
              $p.text("");
            }
          } catch (e) {
            $p.text("");
            console.error(e);
          }
        },
      })
        .then((url) => {
          // download complete
        })
        .catch((error) => {
          // error
          console.error(error);
        });
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

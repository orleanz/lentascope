"use strict";

var DEFAULT_DATE = new Date(2008, 7, 8, 23, 0, 0, 0),
    DEFAULT_FRIENDS = "galkovsky, dolboeb, drugoi, ivan-gandhi, mithgol, avva";

var MAIN_DICT,
    BATCH_SIZE = 10,
    USER_IND, 
    USERS, 
    CUR_MONTH;

var FOUND_POSTS;

var STOP_FLAG = false;

$('#runHotspot').click(run);
$('#stopHotspot').click(stop);

$('#showCache').click(showCache);
$('#clearCache').click(clearCache);

$('#settingsHotspot').click(function() { 

  $('#settings').toggle();

  chrome.storage.sync.get({lentascope_netcount: {cnt: 0, day: null}}, function(items) {

    var dt = new Date();
    var day = pad(dt.getUTCDate()) + "." + pad(1+dt.getUTCMonth()) + "." + dt.getUTCFullYear();
    document.getElementById("netCnt").value = items.lentascope_netcount.day == day ? items.lentascope_netcount.cnt : 0;

  });

});

$('#closeSettings').click(function() { $('#settings').toggle(); });

$('#logHotspot').click(function() { $('#logArea').toggle(); });
$('#closeLog').click(function() { $('#logArea').toggle(); });
$('#clearLog').click(function() { $('#log').text(""); });


$('#infoHotspot').click(function() { $('#info').toggle(); });
$('#closeInfo').click(function() { $('#info').toggle(); });


$('#timeHelp').click(function() { $('#timeHelpBlock').toggle(); });
$('#timeSet').click(function() {
  $('#timeSet').css("color", "gray");
  timeSet();
  setTimeout(function() { $('#timeSet').css("color", "darkblue"); }, 500);
});

$('#startdate').change(timeSet);

$('#clearCache').click(function() { clearCache });

$('#resetFriends').click(function() { $('#friends').val(DEFAULT_FRIENDS); $('#saveFriends').trigger('click'); });
$('#saveFriends').click(function() {
 chrome.storage.sync.set(
    { lentascope_friends: document.getElementById("friends").value.trim()}, 
    function() {
      $("#saveStatus").show();
      setTimeout(function() {  $("#saveStatus").hide()}, 1000);
    }
  );
});

$('#showLogMsg').change(function() { 
 chrome.storage.sync.set( { lentascope_showlog: document.getElementById("showLogMsg").checked} );
});


function timeSet() {

  var ar = $('#startdate').val().split(".");

  var hour = $('#starthour').val();
  var min = $('#startmin').val();
  var sec = $('#startsec').val();

  var tm;
  if (isNaN(hour) || hour > 23 || isNaN(min) || min > 59 || isNaN(sec) || sec > 59) {
    tm = Date.UTC(ar[2], ar[1]-1, ar[0], 0, 0, 0); 
    $('#timeError').show();
  } else {
    tm = Date.UTC(ar[2], ar[1]-1, ar[0], hour, min, sec); 
    $('#timeError').hide();
  }
  
  chrome.storage.sync.set({lentascope_startTm: tm}, function() {
    // var dt = new Date(tm);
    // console.log("saved " + dt.toUTCString());
  });

  $("#startdate").prop("tm", tm);

}

readSettings();

function stop() {

  appendStatusMessage("Stopped by user.");
  STOP_FLAG = true;
  $("#stopHotspot").hide();
  $("#runHotspot").show();

}


function run() {

  var friends = document.getElementById("friends").value.trim();

  if (!friends) {
    var log = document.getElementById("log");
    $(log).show();
    $(log).text("NO FRIEND LIST !");
    return;
  }

  if ( $('#showLogMsg').is( ":checked" ) ) {
    $('#logArea').show();    
  }

  appendStatusMessage("GETTING CALENDARS ... ");

  FOUND_POSTS = [];

  $('#posts').empty();

  STOP_FLAG = false;
  $("#runHotspot").hide();
  $("#stopHotspot").show();


  USER_IND = 0;
  USERS = _.map(friends.split(","), function(x) {return x.trim();});

  var tmp = $('#startdate').val().split(".");
  CUR_MONTH = [1*tmp[2], 1*tmp[1]]; 

  document.getElementById("log").style.display = "block";
  
  ticker();  
 
}


function changeMonth() {

  if (CUR_MONTH[1] > 1) {
    CUR_MONTH[1] -= 1;
  } else {
    CUR_MONTH[1] = 12;
    CUR_MONTH[0] -= 1;
  }

  return CUR_MONTH[0] > 2007; 

}


function readSettings() {

  chrome.storage.sync.get({lentascope_startTm: DEFAULT_DATE.getTime() }, function(items) {
    var dt = new Date(items.lentascope_startTm);
    // need to do this conversion because of datapicker bug 
    var dt2 = new Date(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()); 

    $("#starthour").val(pad(dt.getUTCHours()));
    $("#startmin").val(pad(dt.getUTCMinutes()));
    $("#startsec").val(pad(dt.getUTCSeconds()));

    $("#startdate").datepicker("setDate", dt2);

    $("#startdate").prop('tm', items.lentascope_startTm);

  });

  chrome.storage.sync.get({lentascope_friends: DEFAULT_FRIENDS}, function(items) {
    document.getElementById("friends").value = items.lentascope_friends;
  });

  chrome.storage.sync.get({lentascope_showlog: true}, function(items) {
    document.getElementById("showLogMsg").checked = items.lentascope_showlog;
  });

}

function pad(v) {
  return v < 10 ? "0" + v : v;
}


function updateNetCounter() {

  chrome.storage.sync.get({lentascope_netcount: {cnt: 0, day: null}}, function(items) {

    var dt = new Date();
    var day = pad(dt.getUTCDate()) + "." + pad(1+dt.getUTCMonth()) + "." + dt.getUTCFullYear();
    var newrec;

    if (items.lentascope_netcount.day == day) {
      newrec = {cnt: items.lentascope_netcount.cnt + 1, day: day };
    } else {
      newrec = {cnt: 0, day: day };
    }
    
    chrome.storage.sync.set({lentascope_netcount: newrec});

  });

}

function getPosts(ar) {

  appendStatusMessage("GETTING POSTS ... ");

  if (ar.length == 0) {
    return;
  }

  var ind = 0;
  getOnePost();
  
  function getOnePost() {

    if (STOP_FLAG) {
      stop();
      return;
    }

    updateNetCounter();

    $.ajax({

      type: "GET",
      async: true,
      url: ar[ind][1],

      success: function(msg) {

        appendStatusMessage("getting post " + ind + "/" + ar.length + ": " + ar[ind][1]);
          
        var div = document.createElement("div");
        div.style.margin = "1em 1em 2em 1em";
        div.style.padding = "0.2em";
        div.style.border = "1px solid gainsboro";

        var header = document.createElement("div");
        header.style.marginBottom = "0.5em";
        header.style.backgroundColor = "gainsboro";

        var dt = new Date(ar[ind][0]);

        var img = document.createElement("img");
        img.src = "livejournal-icon.png";
        img.style.verticalAlign = "middle";
        img.style.marginLeft = "1em";
        img.style.position = "relative";
        img.style.top = "-0.1em";

        var userName = document.createElement("span");
        userName.style.fontSize = "large";
        userName.style.marginLeft = "0.1em";
        userName.textContent = ar[ind][2];

        var timestamp = document.createElement("span");
        timestamp.style.marginLeft = "1em";
        timestamp.style.fontSize = "medium";
        timestamp.textContent = pad(dt.getUTCDate()) + "." + pad(1+dt.getUTCMonth()) + "." + dt.getUTCFullYear() + 
          " " + pad(dt.getUTCHours()) + ":" + pad(dt.getUTCMinutes());

        var link = document.createElement("a");
        link.target = "_blank";
        link.href = ar[ind][1];

        var linkImg = document.createElement("img");
        linkImg.src = "link.png";
        linkImg.style.verticalAlign = "middle";
        linkImg.style.marginLeft = "0.4em";
        linkImg.style.position = "relative";
        linkImg.style.top = "-0.1em";
        linkImg.title = "go to original post: " + ar[ind][1];
        link.appendChild(linkImg);

        header.appendChild(link);
        header.appendChild(timestamp);

        header.appendChild(img);
        header.appendChild(userName);

        div.appendChild(header);

        var postInfo = parsePost(msg);
        if (postInfo.subj) div.appendChild(postInfo.subj);
        if (postInfo.art) div.appendChild(postInfo.art);
        
        $('#posts').append(div);
      
        var imgs = postInfo.img;

        if (imgs) {
          for (var i = 0; i < imgs.length; i++) {
            var img = new RAL.RemoteImage({src: imgs[i][1]});
            var span = document.getElementById("img_" + imgs[i][0]);

            if (span) {
              span.appendChild(img.element);
              RAL.Queue.add(img);
            } else {
              console.error("cannot find image: " + imgs[i][1]);
            }      
            
          }          
        }

        RAL.Queue.setMaxConnections(4);
        RAL.Queue.start();

        ind += 1;
        if (ind < ar.length) {
        
          setTimeout(getOnePost, 500);
        
        } else {

          var nextBtn = document.createElement("div");
          nextBtn.style.padding = "0.2em";
          nextBtn.style.textAlign = "center";
          nextBtn.style.color = "darkblue";
          nextBtn.style.cursor = "pointer";

          nextBtn.textContent = "[ NEXT ]";
          nextBtn.title = "get next posts (backwards from last one)";

          $(nextBtn).click(run);

          $('#posts').append(nextBtn);
          // $(nextBtn).animatescroll({padding:300, scrollSpeed:500});

          appendStatusMessage("POSTS READY.");
          $('#logArea').hide();

          $("#stopHotspot").hide();
          $("#runHotspot").show();

        }

      },

      error: function(XMLHttpRequest, textStatus, errorThrown) {
    
        appendStatusMessage("ERROR: " + textStatus);
        console.error(textStatus);

      }

    });

  }

}


function appendStatusMessage(txt) {

  var log = document.getElementById("log");
  log.textContent = log.textContent + "\n" + txt;
  log.scrollTop = log.scrollHeight;

}


function ticker() {

  if (STOP_FLAG) {
    STOP_FLAG = false;
    return;
  }

  if ((USER_IND == 0 && FOUND_POSTS.length > BATCH_SIZE) || CUR_MONTH[0] <= 1999) {

    FOUND_POSTS.sort(function(a,b) {return 1*b[0] - 1*a[0]; });

    var shortAr = FOUND_POSTS.slice(0, BATCH_SIZE);

    if (shortAr.length == 0) {

      appendStatusMessage("NO POSTS FOUND in the specified range for specified users.");
      stop();

    } else {

      appendStatusMessage("CALENDARS READY.");
      getPosts(shortAr);

      var lastPostDate = new Date(1*shortAr[shortAr.length-1][0]);
      chrome.storage.sync.set({lentascope_startTm: lastPostDate.getTime()}, function() {
        readSettings();
      });

    }

    return;

  }

  if (USER_IND == 0) {
    appendStatusMessage("=> " + CUR_MONTH.join("/") + " ....");
  }

  appendStatusMessage("getting calendar of: " + USERS[USER_IND] + " (#" + (USER_IND+1) + " of " + USERS.length + ")," + 
    " month: " + CUR_MONTH.join("/"));


  var year = CUR_MONTH[0];
  var month = "" + CUR_MONTH[1];
  if (month.length < 2) month = "0" + month;

  getMonth(USERS[USER_IND], year + "/" + month);

}


function addToResultRange(user, ar) {

  var tm = 1*$("#startdate").prop('tm');

  for (var i = 0; i < ar.length; i++) {
    var posting = ar[i];
    if (posting.t <= tm) {

      var link;
      if (1*posting.l > 0) {
        link = 'http://' + user + '.livejournal.com/' + posting.l + '.html?format=light';
      } else {
        link = 'http://users.livejournal.com/' + user + '/' + (-1*posting.l) + '.html?format=light'; 
      }

      FOUND_POSTS.push( [posting.t, link, user] );
    } 
  }

}


function relaunch(waitMs) {

  if (USER_IND < USERS.length-1) {
    USER_IND += 1;
  } else {
    USER_IND = 0;
    changeMonth();
  }

  setTimeout(ticker, waitMs); 

}


function getMonth(user, month) {

  var url = "http://users.livejournal.com/" + user + "/" + month + "/?format=light";

  var calendar = user + "/" + month;

  chrome.storage.local.get( {lentascope_cache : "{}"}, function(items) {

    var dict = JSON.parse(items.lentascope_cache);

    if (dict[calendar]) {

      appendStatusMessage("found in local cache: " + calendar);
      addToResultRange(user, dict[calendar]);
      relaunch(100);

    } else {

      updateNetCounter();

      $.ajax({

        type: "GET",
        async: true,
        url: url,

        success: function(msg) {

          appendStatusMessage("got from livejournal server: " + calendar);
          dict[calendar] = parse(msg);

          chrome.storage.local.set({lentascope_cache: JSON.stringify(dict)});

          addToResultRange(user, dict[calendar]);
          relaunch(3000);

        },

        error: function(XMLHttpRequest, textStatus, errorThrown) {
          console.error(textStatus);
        }

      });
      
    }
   

  });

}


function parsePost(txt) {

  var textOrig = txt;

  var b = '<div class="b-singlepost-wrapper">';
  var e = '</article>';

  var pos = txt.indexOf(b);

  if (pos == -1) {
    return {subj: document.createTextNode("PARSE_ERROR_START_TAG") };
  }

  var txt2 = txt.substr(pos + b.length);
  var pos2 = txt2.indexOf(e);

  if (pos2 == -1) {
    return {subj: document.createTextNode("PARSE_ERROR_END_TAG") };
  } 

  var txt = txt2.substr(0, pos2);

  txt = txt.replace(/<img/gi, "<input");
  var prefix = "lentascope_src_";
  txt = txt.replace(/src=/gi, "title=" + prefix);

  var html = $(txt);
  var imgs = $(html).find("input");

  var imgSrcArr = [];

  for (var i = 0; i < imgs.length; i++) {
    if (imgs[i].title.substr(0, prefix.length) == prefix) {
      var src = imgs[i].title.substr(prefix.length+1);
      src = src.substr(0, src.length-1);
      var uuid = guid();
      imgSrcArr.push( [uuid, src] );
      var s = document.createElement("span");
      s.id = "img_" + uuid;
      imgs[i].parentNode.replaceChild(s, imgs[i]);
    }
  }

  var subj, article;
  for (var i = 0; i < html.length; i++) {
    if (html[i].nodeName == "H1") {
      subj = html[i];
    }
    if (html[i].nodeName == "ARTICLE") {
      article = html[i];
    }
  }

  return {subj: subj, art: article, img: imgSrcArr};

}


var guid = (function() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
               .toString(16)
               .substring(1);
  }
  return function() {
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
           s4() + '-' + s4() + s4() + s4();
  };
})();


function parse(txt) {

  txt = txt.replace(/\n|\r/g, "");

  var patternBlock = new RegExp("<dt>(.+?)</dt>.*?<dd>(.+?)</dd>");
  var matchBlock = txt.match(patternBlock);

  var ar = [];
  
  while (matchBlock) {

    var patternDate = new RegExp("http:.+livejournal\.com/.*/?(\\d\\d\\d\\d\/\\d\\d\/\\d\\d)");
    var matchDate = matchBlock[1].match(patternDate);

    if (matchDate) {
      ar.push( [matchDate[1], matchBlock[2] ] );
    }

    txt = txt.substr(matchBlock.index + matchBlock[0].length);

    matchBlock = txt.match(patternBlock);
  }


  var result = [];

  for (var i = 0; i < ar.length; i++) {

    var tmp = ar[i][1];

    var patternRecord = new RegExp("(\\d\\d?:\\d\\d[p|a]).+?href='(http:.+?\\.html)'");
    var matchRecord = tmp.match(patternRecord);

    while (matchRecord) {

      var tm = matchRecord[1];
      if (tm.length === 5) {
        tm = "0" + tm;
      }

      var hr = 1 * tm.substr(0,2);
      var min = tm.substr(3,2);
      var x = tm.substr(5,1);

      if (hr == 12) {
        if (x == "a") {
          hr = 0;
        }
      } else {
        if (x == "p") {
          hr += 12;
        }
      }

      var timestamp = Date.UTC(ar[i][0].substr(0,4), 1*ar[i][0].substr(5,2)-1, ar[i][0].substr(8,2), hr, min, 0);
      result.push( {t: timestamp, l: minify(matchRecord[2]) } );

      // var dt = new Date(timestamp).toUTCString();
      // console.log(ar[i][0] + " " + matchRecord[1] + " " + hr + ":" + min + ", " + timestamp + ", " + matchRecord[2]);

      tmp = tmp.substr(matchRecord.index + matchRecord[0].length);

      matchRecord = tmp.match(patternRecord);
    }

  }

  return result;

}



function minify(link) {

  var patt1 = new RegExp("http://(.+).livejournal.com/(\\d+)\.html");
  var match1 = link.match(patt1);

  if (match1) {

    return 1 * match1[2];

  } else {

    var patt2 = new RegExp("http://users.livejournal.com/(.+?)/(\\d+)\.html");
    var match2 = link.match(patt2);

    if (match2) {
      return -1 * match2[2];
    } else {
      console.error("bad link: " + link);
      return "";
    }
  }


}

function showCache() {

  chrome.storage.local.get( {lentascope_cache : "{}"}, function(items) {

    var dict = JSON.parse(items.lentascope_cache);

    var ar = _.keys(dict);

    if (ar.length == 0) {
      $('#cacheContent').text("[ cache empty; it was cleared or this tool was never used yet ]");
    } else {
      $('#cacheContent').text( _.keys(dict).join(", "));
    }

  });

}


function clearCache() {

   chrome.storage.local.remove("lentascope_cache", function(items) {

    $('#cacheContent').text("");

  });

}
var socket = io.connect();

function changeDisplayTime(shrs, smins, ssecs) {
  if (shrs.length === 1) {
    shrs = "0" + shrs;
  }
  if (smins.length === 1) {
    smins = "0" + smins;
  }
  if (ssecs.length === 1) {
    ssecs = "0" + ssecs;
  }
  $(".timer-div h1").html(`${shrs}:${smins}:${ssecs}`);
}

socket.on("updateAuctions", function ({ auctions }) {
  
  var iwallet = Number(wallet)
  $(".auction-list").empty();
  for (var i = 0; i < auctions.length; i++) {
    const link = "/enterauction/" + String(i);
    if (iwallet >= auctions[i].baseprice) {
      $(".auction-list").append(`
    <div class="auction-li">
              <img src="https://tse2.mm.bing.net/th?id=OIP.avb9nDfw3kq7NOoP0grM4wHaEK&pid=Api&P=0">
              
              <div class="w-100">
                <div>Product Name: ${auctions[i].product}</div>
                <div>Auction Started at: ${auctions[i].startTime}</div>
                <a href=${link}>Click to bid</a>
            </div>
          </div>
    `);
    } 
    else {
      $(".auction-list").append(`
    <div class="auction-li">
              <img src="https://tse2.mm.bing.net/th?id=OIP.avb9nDfw3kq7NOoP0grM4wHaEK&pid=Api&P=0">
              
              <div class="w-100">
                <div>Product Name: ${auctions[i].product}</div>
                <div>Auction Started at: ${auctions[i].startTime}</div>
                <a href="#">Insufficient amount</a>
            </div>
          </div>
    `);
    }
  }
});

socket.on("auctionCompleted", () => {
  location.href = '/user'
});

socket.on("timer", ({ time }) => {
  console.log("here");
  let hrs = Math.floor(time / 3600);
  let mins = Math.floor((time % 3600) / 60);
  let secs = (time % 3600) % 60;
  const shrs = String(hrs)
  const smins = String(mins)
  const ssecs = String(secs)
  changeDisplayTime(shrs,smins,ssecs)
});

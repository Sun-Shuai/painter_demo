//index.js

import Card from '../../palette/palette1';

Page({

  chooseImage: function() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      success: res => {
        let path = res.tempFilePaths[0]
        wx.getImageInfo({
          src: path,
          success: res => {
            this.setData({
              template: new Card().palette(path, res.width, res.height),
            });
          }
        })
      },
    })
  },

  onImgOK(e) {
    wx.saveImageToPhotosAlbum({
      filePath: e.detail.path,
    });
  },

});
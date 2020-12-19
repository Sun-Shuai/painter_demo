import Pen from './lib/pen';
import Downloader from './lib/downloader';
import WxCanvas from './lib/wx-canvas';

const downloader = new Downloader();
const MAX_PAINT_COUNT = 5;

Component({
  canvasWidthInPx: 0,
  canvasHeightInPx: 0,
  canvasNode: null,
  paintCount: 0,

  properties: {
    use2D: {
      type: Boolean,
      value: true
    },
    customStyle: {
      type: String,
    },
    palette: {
      type: Object,
      observer: function (newVal, oldVal) {
        if (this.isNeedRefresh(newVal, oldVal)) {
          this.paintCount = 0;
          this.startPaint();
        }
      },
    },
    widthPixels: {
      type: Number,
      value: 0
    }
  },

  data: {},

  methods: {

    isEmpty(object) {
      for (const i in object) {
        return false;
      }
      return true;
    },

    isNeedRefresh(newVal, oldVal) {
      if (!newVal || this.isEmpty(newVal)) {
        return false;
      }
      return true;
    },

    initScreenK() {
      if (!(getApp() && getApp().systemInfo && getApp().systemInfo.screenWidth)) {
        try {
          getApp().systemInfo = wx.getSystemInfoSync();
        } catch (e) {
          console.error(`Painter get system info failed, ${JSON.stringify(e)}`);
          return;
        }
      }
      this.screenK = 0.5;
      if (getApp() && getApp().systemInfo && getApp().systemInfo.screenWidth) {
        this.screenK = getApp().systemInfo.screenWidth / 750;
      }
      setStringPrototype(this.screenK, 1);
    },

    startPaint() {
      this.initScreenK();
      this.downloadImages(this.properties.palette).then(async (palette) => {
        const {
          width,
          height
        } = palette;

        if (!width || !height) {
          console.error(`You should set width and height correctly for painter, width: ${width}, height: ${height}`);
          return;
        }

        let needScale = false;

        if (width.toPx() !== this.canvasWidthInPx) {
          this.canvasWidthInPx = width.toPx();
          needScale = this.properties.use2D;
        }
        if (this.properties.widthPixels) {
          setStringPrototype(this.screenK, this.properties.widthPixels / this.canvasWidthInPx)
          this.canvasWidthInPx = this.properties.widthPixels
        }

        if (this.canvasHeightInPx !== height.toPx()) {
          this.canvasHeightInPx = height.toPx();
          needScale = needScale || this.properties.use2D;
        }

        this.setData({
          photoStyle: `width:${this.canvasWidthInPx}px;height:${this.canvasHeightInPx}px;`,
        });
        if (!this.photoContext) {
          this.photoContext = await this.getCanvasContext(this.properties.use2D, 'photo');
        }

        if (needScale) {
          const scale = getApp().systemInfo.pixelRatio;
          this.photoContext.width = this.canvasWidthInPx * scale;
          this.photoContext.height = this.canvasHeightInPx * scale;
          this.photoContext.scale(scale, scale);
        }

        new Pen(this.photoContext, palette).paint(() => {
          this.saveImgToLocal();
        });
        setStringPrototype(this.screenK, 1);
      });
    },

    downloadImages(palette) {
      return new Promise((resolve, reject) => {
        let preCount = 0;
        let completeCount = 0;
        const paletteCopy = JSON.parse(JSON.stringify(palette));
        if (paletteCopy.background) {
          preCount++;
          downloader.download(paletteCopy.background).then((path) => {
            paletteCopy.background = path;
            completeCount++;
            if (preCount === completeCount) {
              resolve(paletteCopy);
            }
          }, () => {
            completeCount++;
            if (preCount === completeCount) {
              resolve(paletteCopy);
            }
          });
        }
        if (paletteCopy.views) {
          for (const view of paletteCopy.views) {
            if (view && view.type === 'image' && view.url) {
              preCount++;
              downloader.download(view.url).then((path) => {
                view.originUrl = view.url;
                view.url = path;
                wx.getImageInfo({
                  src: path,
                  success: (res) => {
                    view.sWidth = res.width;
                    view.sHeight = res.height;
                  },
                  fail: (error) => {
                    view.url = "";
                    console.error(`getImageInfo ${view.url} failed, ${JSON.stringify(error)}`);
                  },
                  complete: () => {
                    completeCount++;
                    if (preCount === completeCount) {
                      resolve(paletteCopy);
                    }
                  },
                });
              }, () => {
                completeCount++;
                if (preCount === completeCount) {
                  resolve(paletteCopy);
                }
              });
            }
          }
        }
        if (preCount === 0) {
          resolve(paletteCopy);
        }
      });
    },

    saveImgToLocal() {
      const that = this;
      setTimeout(() => {
        wx.canvasToTempFilePath({
          canvasId: 'photo',
          canvas: that.properties.use2D ? that.canvasNode : null,
          destWidth: that.canvasWidthInPx * getApp().systemInfo.pixelRatio,
          destHeight: that.canvasHeightInPx * getApp().systemInfo.pixelRatio,
          fileType: 'jpg',
          quality: 0.8,
          success: function (res) {
            that.getImageInfo(res.tempFilePath);
          },
          fail: function (error) {
            console.error(`canvasToTempFilePath failed, ${JSON.stringify(error)}`);
            that.triggerEvent('imgErr', {
              error: error
            });
          },
        }, this);
      }, 300);
    },

    getCanvasContext(use2D, id) {
      console.log('canvas2D:' + use2D);
      const that = this;
      return new Promise(resolve => {
        if (use2D) {
          const query = wx.createSelectorQuery().in(that);
          const selectId = `#${id}`;
          query.select(selectId)
            .fields({
              node: true,
              size: true
            })
            .exec((res) => {
              that.canvasNode = res[0].node;
              const ctx = that.canvasNode.getContext('2d');
              const wxCanvas = new WxCanvas('2d', ctx, id, true, that.canvasNode);
              resolve(wxCanvas);
            });
        } else {
          const temp = wx.createCanvasContext(id, that);
          resolve(new WxCanvas('mina', temp, id, true));
        }
      })
    },

    getImageInfo(filePath) {
      const that = this;
      wx.getImageInfo({
        src: filePath,
        success: (infoRes) => {
          if (that.paintCount > MAX_PAINT_COUNT) {
            const error = `The result is always fault, even we tried ${MAX_PAINT_COUNT} times`;
            console.error(error);
            that.triggerEvent('imgErr', {
              error: error
            });
            return;
          }
          if (Math.abs((infoRes.width * that.canvasHeightInPx - that.canvasWidthInPx * infoRes.height) / (infoRes.height * that.canvasHeightInPx)) < 0.01) {
            that.triggerEvent('imgOK', {
              path: filePath
            });
          } else {
            that.startPaint();
          }
          that.paintCount++;
        },
        fail: (error) => {
          console.error(`getImageInfo failed, ${JSON.stringify(error)}`);
          that.triggerEvent('imgErr', {
            error: error
          });
        },
      });
    },
  },
});


function setStringPrototype(screenK, scale) {
  /**
   * 是否支持负数
   * @param {Boolean} minus 是否支持负数
   */
  String.prototype.toPx = function toPx(minus, baseSize) {
    if (this === '0') {
      return 0
    }
    let reg;
    if (minus) {
      reg = /^-?[0-9]+([.]{1}[0-9]+){0,1}(rpx|px|%)$/g;
    } else {
      reg = /^[0-9]+([.]{1}[0-9]+){0,1}(rpx|px|%)$/g;
    }
    const results = reg.exec(this);
    if (!this || !results) {
      console.error(`The size: ${this} is illegal`);
      return 0;
    }
    const unit = results[2];
    const value = parseFloat(this);

    let res = 0;
    if (unit === 'rpx') {
      res = Math.round(value * (screenK || 0.5) * (scale || 1));
    } else if (unit === 'px') {
      res = Math.round(value * (scale || 1));
    } else if (unit === '%') {
      res = Math.round(value * baseSize / 100);
    }
    return res;
  };
}
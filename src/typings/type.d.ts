export {}

// export type defaultRedPacketConfig = {
//   id: number,
//   width: number,
//   height: number,
//   speed: number,
//   imageEl: HTMLImageElement
// }

export type CanvasContextType = {
  ctx: CanvasRenderingContext2D
  params: {
    width: number
    height: number
  }
}

export type RedPacketType = {
  /** 红包 id */
  id: number
  /** x轴位置 */
  x: number
  /** y轴位置 */
  y: number
  /** 红包宽度 */
  width: number
  /** 红包高度 */
  height: number
  /** 红包下降速度 */
  speed: number
  /** 红包旋转角度 */
  rotate: number
  /** 红包旋转速度 */
  rotateSpeed: number
  /** 红包图片元素 */
  imageEl: HTMLImageElement
  /** 辅助红包被命中时判断的颜色值 */
  subHitColor: string
  /** 红包层级 */
  zIndex: number
}

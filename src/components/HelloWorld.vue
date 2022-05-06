<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RedPacketType } from '../typings/type';
import { getHashColor, loadImages } from '../utils';

const redPacketsCanvasRef = ref<HTMLCanvasElement>()
const redPacketsContext = ref<ReturnType<typeof initCanvas>>()
const hitSubCanvasRef = ref<HTMLCanvasElement>()
const hitSubCanvasContext = ref<ReturnType<typeof initCanvas>>()

const redPacketList = ref<Record<number | string, RedPacketType>>({})
const rafRedPacketsMove = ref<number>()
const redPacketAccumIndex = ref(1)

type MockConfigType = {
  width?: number
  height?: number
  speed?: number
  imageUrl?: string
  maxRotateDeg?: number
  renderTime?: number
  screenPadding?: number
  split?: number
  totalPackets?: number
}
const props = withDefaults(defineProps<MockConfigType>(), {
  width: 60,
  height: 75.75,
  speed: 3,
  imageUrl: 'game-red-packet.png',
  maxRotateDeg: 30,
  renderTime: 1200,
  screenPadding: 20,
  split: 4,
  totalPackets: 30,
  padding: 20,
})

function initCanvas(
  canvasElement: HTMLCanvasElement,
  params: { width?: number; height?: number } = {}
) {
  const canvasWidth = params.width ?? window.innerWidth
  const canvasHeight = params.height ?? window.innerHeight

  canvasElement.width = canvasWidth
  canvasElement.height = canvasHeight

  return {
    ctx: canvasElement.getContext('2d')!,
    params: {
      width: canvasWidth,
      height: canvasHeight,
    },
  }
}

async function createRedPacketItemObject({ x, y }: { x: number; y: number }) {
  const id = Math.random() * 1e18
  const { width, height, imageUrl, speed } = props
  const config: RedPacketType = {
    id,
    x,
    y: y - height * 1.5,
    width,
    height,
    imageEl: await loadImages(imageUrl),
    speed,
    rotate: 0,
    rotateSpeed: Math.round(Math.random()) ? 0.2 : -0.2,
    subHitColor: getHashColor(Object.values(redPacketList.value).map((x) => x.subHitColor ?? '')),
    zIndex: redPacketAccumIndex.value++
  }

  redPacketList.value[id] = config

  return config
}

async function renderRedPacketItem() {
  if (redPacketsContext.value && hitSubCanvasContext.value) {
    const { ctx, params: canvasParams } = redPacketsContext.value
    const { ctx: hitCtx } = hitSubCanvasContext.value
    ctx.clearRect(0, 0, canvasParams.width, canvasParams.height)
    hitCtx.clearRect(0, 0, canvasParams.width, canvasParams.height)

    for (const [id, redPacket] of Object.entries(redPacketList.value)) {
      const { y, speed } = redPacket
      rotateRedPicketElement(ctx, redPacket, hitCtx)
      redPacketList.value[id].y = y + speed

      if (redPacketList.value[id].y > canvasParams.height) {
        console.log(`[hidden-delete-${id}]`, redPacketList.value[id])
        delete redPacketList.value[id]
      }
    }

    rafRedPacketsMove.value = requestAnimationFrame(renderRedPacketItem)
  }
}

function rotateRedPicketElement(
  ctx: CanvasRenderingContext2D,
  params: RedPacketType,
  hitCtx: CanvasRenderingContext2D
) {
  function rotateThresholdValue(rotate: number) {
    const { maxRotateDeg } = props
    if (Math.abs(rotate) >= maxRotateDeg) {
      return rotate > 0 ? maxRotateDeg : -maxRotateDeg
    }
    return rotate
  }

  ctx.save()
  const { id, x, y, width, height, rotate, imageEl, rotateSpeed, subHitColor } = params
  const centerPointPosition = {
    x: x + width / 2,
    y: y + height / 2,
  }
  ctx.translate(centerPointPosition.x, centerPointPosition.y)
  ctx.rotate((rotate * Math.PI) / 180)
  ctx.translate(-centerPointPosition.x, -centerPointPosition.y)
  ctx.drawImage(imageEl, x, y, width, height)
  ctx.restore()

  hitCtx.save()
  hitCtx.translate(centerPointPosition.x, centerPointPosition.y)
  hitCtx.rotate((rotate * Math.PI) / 180)
  hitCtx.translate(-centerPointPosition.x, -centerPointPosition.y)
  hitCtx.fillStyle = subHitColor
  hitCtx.fillRect(x, y, width, height)
  hitCtx.restore()

  redPacketList.value[id].rotate = rotateThresholdValue(rotate + rotateSpeed)
}

function clickCanvas(e: MouseEvent, ctx: CanvasRenderingContext2D) {
  const { offsetX, offsetY } = e
  const isClickArray = []


  for (const [id, redPacketItem] of Object.entries(redPacketList.value)) {
    const { width, height, x, y } = redPacketItem
    const point = {
      x1: x,
      y1: y,
      x2: x + width,
      y2: y + height
    }
    const isHandle = offsetX >= point.x1 && offsetX <= point.x2 && offsetY >= point.y1 && offsetY <= point.y2
    if (isHandle) {
      isClickArray.push(redPacketItem)
    }
  }

  if (isClickArray[0]) {
    const sortArray = isClickArray.sort((a, b) => b.zIndex - a.zIndex)
    const { id } = sortArray[0]
    delete redPacketList.value[id]
  }
}

function hitSubCanvas(e: MouseEvent, ctx: CanvasRenderingContext2D) {
  const { offsetX, offsetY } = e

  const [r, g, b] = ctx.getImageData(offsetX, offsetY, 1, 1).data
  const rgb = `rgb(${r},${g},${b})`

  const hitRedPacketItem = Object.values(redPacketList.value).find((x) => x.subHitColor === rgb)

  if (hitRedPacketItem) {
    console.log(`[hit-delete-${hitRedPacketItem.id}]`, hitRedPacketItem)
    delete redPacketList.value[hitRedPacketItem.id]
  }
}

function computedXPoint() {
  const { split, screenPadding, width } = props
  const maxScreenWidth = window.innerWidth - screenPadding * 2
  const maxFreeSpace = maxScreenWidth - width * split
  const marginSpace = maxFreeSpace / (split + 1)
  return Object.keys([...Array(split)]).map(Number).map(x => screenPadding + marginSpace + (width + marginSpace) * x)
}

function getRandomArray(array: number[]) {
  return array.sort(() => 0.5 - Math.random())
}

onMounted(async () => {
  if (redPacketsCanvasRef.value && hitSubCanvasRef.value) {
    redPacketsContext.value = initCanvas(redPacketsCanvasRef.value)
    hitSubCanvasContext.value = initCanvas(hitSubCanvasRef.value)

    const pointList = computedXPoint()
    const { split, totalPackets } = props
    const allPointList = [...Array(Math.ceil(totalPackets / split))].map(() => getRandomArray(pointList)).flat().splice(0, totalPackets).map(Math.ceil)

    let index = 0
    let timer: number | null = null
    createRedPacketItemObject({ x: allPointList[index++], y: 0 })
    timer = setInterval(() => {
      if (index >= totalPackets - 1) {
        clearInterval(timer!)
      }
      createRedPacketItemObject({ x: allPointList[index++], y: 0 })
    }, 700)

    renderRedPacketItem()

    hitSubCanvasRef.value.addEventListener('click', (e) =>
      hitSubCanvas(e, hitSubCanvasContext.value!.ctx)
    )
  }
})
</script>

<template>
  <canvas ref="redPacketsCanvasRef" />
  <canvas ref="hitSubCanvasRef" style="opacity: 0" />
</template>

<style>
canvas {
  position: absolute;
  top: 0;
  left: 0;
}
</style>

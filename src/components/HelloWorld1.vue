<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RedPacketType } from '../typings/type';
import { getHashColor, getRandomArbitrary, loadImages } from '../utils';

const gameContainerRef = ref<HTMLElement>()
const redPacketList = ref<number[]>([])
const hitedPacketIdList = ref<number[]>([])

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
  padding?: number
}
const props = withDefaults(defineProps<MockConfigType>(), {
  width: 147,
  height: 186,
  speed: 3,
  imageUrl: 'game-red-packet.png',
  maxRotateDeg: 30,
  renderTime: 1200,
  screenPadding: 20,
  split: 4,
  totalPackets: 30,
  padding: 20,
})

function hitPacket(id: number) {
  if (!hitedPacketIdList.value.includes(id)) {
    hitedPacketIdList.value.push(id)
    const hitEl = document.querySelector(`#packet-${id}`)

    if (gameContainerRef.value && hitEl) {
      const { top, left, width, height } = hitEl.getBoundingClientRect()
      gameContainerRef.value.removeChild(hitEl)
      const topPoint = top + height / 2
      const lefPoint = left + width / 2
      const hitImageEl = document.createElement('img')
      hitImageEl.classList.add('hit-animation')
      hitImageEl.src = new URL(`../assets/add-done.png`, import.meta.url).href
      hitImageEl.style.position = 'absolute'
      hitImageEl.style.top = topPoint + 'px'
      hitImageEl.style.left = lefPoint + 'px'
      hitImageEl.style.width = getPx2VWSize(96) + 'px'
      hitImageEl.style.height = getPx2VWSize(50) + 'px'
      document.body.appendChild(hitImageEl)
      setTimeout(() => {
        document.body.removeChild(hitImageEl)
      }, 800)
    }
  }
}

function createRedPacket(xPonit: number) {
  const id = Math.random() * 1e18
  redPacketList.value.push(id)

  const { width, height, imageUrl, padding } = props

  const packetWrapperEl = document.createElement('div')
  packetWrapperEl.classList.add('red-packet-img-wrapper')
  packetWrapperEl.id = 'packet-' + id
  packetWrapperEl.style.width = getPx2VWSize(width) + 'px'
  packetWrapperEl.style.height = getPx2VWSize(height) + getPx2VWSize(padding * 2) + 'px'
  packetWrapperEl.style.left = xPonit + 'px'

  const packetEl = document.createElement('img')
  // packetEl.ondragstart = () => false
  packetEl.src = new URL(`../assets/${imageUrl}`, import.meta.url).href
  packetEl.classList.add('red-packet-img')
  packetEl.style.padding = `${getPx2VWSize(padding)}px 0`

  setTimeout(() => {
    packetEl.style.transform = `rotate(${Math.random() > 0.5 ? 30 : -30}deg)`
  }, 100);
  // packetEl.onclick = () => hitPacket(id)
  packetWrapperEl.appendChild(packetEl)
  gameContainerRef.value!.appendChild(packetWrapperEl)
}




function computedXPoint() {
  const { split, screenPadding, width } = props
  const maxScreenWidth = (window.innerWidth > 750 ? 750 : window.innerWidth) - screenPadding * 2
  const maxFreeSpace = maxScreenWidth - getPx2VWSize(width) * split
  const marginSpace = maxFreeSpace / (split + 1)
  return Object.keys([...Array(split)]).map(Number).map(x => screenPadding + marginSpace + (getPx2VWSize(width) + marginSpace) * x)
}

function getRandomArray(array: number[]) {
  return array.sort(() => 0.5 - Math.random())
}

function watchPacketList() {
  const clientHeight = document.documentElement.clientHeight
  redPacketList.value.forEach(packetId => {
    const packetElement = document.querySelector(`#packet-${packetId}`)

    if (packetElement && gameContainerRef.value) {
      const top = packetElement.getBoundingClientRect().top
      if (top >= clientHeight) {
        gameContainerRef.value.removeChild(packetElement)
      }
    }
  })
}

function getPx2VWSize(pixel: number) {
  const maxWindowInnerWidth = window.innerWidth > 750 ? 750 : window.innerWidth
  const design1px2vw = 1 / (750 / 100)
  const current1px2vw = pixel * design1px2vw * (maxWindowInnerWidth / 100)
  return current1px2vw
}

onMounted(async () => {
  const pointList = computedXPoint()
  const { split, totalPackets } = props
  const allPointList = [...Array(Math.ceil(totalPackets / split))].map(() => getRandomArray(pointList)).flat().splice(0, totalPackets).map(Math.ceil)

  let index = 0
  let timer: number | null = null
  createRedPacket(allPointList[index++])
  timer = setInterval(() => {
    if (index >= totalPackets - 1) {
      clearInterval(timer!)
    }
    createRedPacket(allPointList[index++])
  }, 700)

  setInterval(() => {
    watchPacketList()
  }, 1000);

  if (gameContainerRef.value) {
    gameContainerRef.value.addEventListener('click', (e) => {
      const hitClassName = (e.target as HTMLElement).className
      if (hitClassName === 'red-packet-img') {

        const hitEl = (e as any).path[1]
        const id = hitEl.id

        if (!hitedPacketIdList.value.includes(id)) {
          hitedPacketIdList.value.push(id)
          const { top, left, width, height } = hitEl.getBoundingClientRect()
          gameContainerRef.value!.removeChild(hitEl)
          const topPoint = top + height / 2
          const lefPoint = left + width / 2
          const hitImageEl = document.createElement('img')
          hitImageEl.classList.add('hit-animation')
          hitImageEl.src = new URL(`../assets/add-done.png`, import.meta.url).href
          hitImageEl.style.position = 'absolute'
          hitImageEl.style.top = topPoint + 'px'
          hitImageEl.style.left = lefPoint + 'px'
          hitImageEl.style.width = getPx2VWSize(96) + 'px'
          hitImageEl.style.height = getPx2VWSize(50) + 'px'
          document.body.appendChild(hitImageEl)
          setTimeout(() => {
            document.body.removeChild(hitImageEl)
          }, 800)
        }
      }
    })
  }
})
</script>

<template>
  <div class="game-container" ref="gameContainerRef"></div>
</template>

<style lang="scss">
.game-container {
  width: 100vw;
  height: 100vh;
  max-width: 750px;
  margin: 0 auto;
  overflow: hidden;
  position: fixed;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  background-image: url('../assets/game-bg.png');
  background-position: center;
  background-size: cover;

  .red-packet-img-wrapper {
    position: absolute;
    top: 0;
    left: 0;
    transform: translateY(-100%);
    animation: down 3s linear forwards;
    font-size: 0;
  }

  .red-packet-img {
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    position: relative;
    transition: all 3s ease;
    transform: rotate(0);
  }

  @keyframes down {
    0% {
      transform: translateY(-100%);
    }

    100% {
      transform: translateY(110vh);
    }
  }
}
</style>

<style>
.hit-animation {
  animation: rise 0.7s ease forwards;
}

@keyframes rise {
  0% {
    transform: translateY(0);
    opacity: 1;
  }

  100% {
    transform: translateY(-100%);
    opacity: 0;
  }
}
</style>
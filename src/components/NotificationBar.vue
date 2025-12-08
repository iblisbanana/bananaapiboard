<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { getTenantHeaders } from '@/config/tenant'

const notification = ref(null)
const isVisible = ref(false)
const animationDuration = ref(20)

// 加载通知配置
async function loadNotification() {
  try {
    const r = await fetch('/api/tenant/notification', {
      headers: getTenantHeaders()
    })
    if (r.ok) {
      const data = await r.json()
      if (data.enabled && data.content) {
        notification.value = data
        isVisible.value = true
        // 根据滚动速度计算动画时长（像素/秒 -> 秒）
        if (data.scroll_speed) {
          // 估算内容宽度（约每个字符15px）+ 100%视口宽度
          const estimatedWidth = data.content.length * 15 + window.innerWidth
          animationDuration.value = estimatedWidth / data.scroll_speed
        }
      }
    }
  } catch (e) {
    console.error('加载通知栏失败', e)
  }
}

// 解析内容中的链接（支持 [文本](链接) 语法）
const parsedContent = computed(() => {
  if (!notification.value?.content) return ''
  
  // 替换 [文本](链接) 格式为 HTML 链接
  let content = notification.value.content
  content = content.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g, 
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="underline hover:text-white transition-colors font-semibold">$1</a>'
  )
  
  return content
})

// 计算样式
const barStyle = computed(() => {
  if (!notification.value) return {}
  return {
    backgroundColor: notification.value.background_color || '#FEF3C7',
    color: notification.value.text_color || '#92400E'
  }
})

onMounted(() => {
  loadNotification()
})
</script>

<template>
  <Transition name="slide-down">
    <div 
      v-if="isVisible && notification" 
      class="notification-bar relative overflow-hidden shadow-md border-b"
      :style="barStyle"
    >
      <div class="notification-content">
        <div 
          class="notification-text flex items-center gap-2 whitespace-nowrap"
          :style="{ animationDuration: `${animationDuration}s` }"
        >
          <!-- 使用 v-html 渲染解析后的内容（包含emoji和链接） -->
          <span v-html="parsedContent" class="inline-flex items-center"></span>
          <!-- 重复一次内容以实现无缝滚动 -->
          <span v-html="parsedContent" class="inline-flex items-center ml-20"></span>
        </div>
      </div>
      
      <!-- 关闭按钮 -->
      <button
        @click="isVisible = false"
        class="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-black/10 transition-colors z-10"
        title="关闭通知栏"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
      </button>
    </div>
  </Transition>
</template>

<style scoped>
.notification-bar {
  position: relative;
  min-height: 40px;
  display: flex;
  align-items: center;
  font-size: 0.875rem;
  font-weight: 500;
}

.notification-content {
  width: 100%;
  overflow: hidden;
  padding: 0.625rem 3rem 0.625rem 1rem;
}

.notification-text {
  display: inline-flex;
  animation: scroll-left linear infinite;
  will-change: transform;
}

@keyframes scroll-left {
  0% {
    transform: translateX(0);
  }
  100% {
    transform: translateX(-50%);
  }
}

/* 悬停时暂停动画 */
.notification-bar:hover .notification-text {
  animation-play-state: paused;
}

/* 过渡动画 */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease-out;
}

.slide-down-enter-from {
  opacity: 0;
  transform: translateY(-100%);
}

.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-100%);
}

/* 链接样式继承文本颜色 */
.notification-bar :deep(a) {
  color: inherit;
  text-decoration: underline;
  font-weight: 600;
  transition: opacity 0.2s;
}

.notification-bar :deep(a:hover) {
  opacity: 0.8;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .notification-bar {
    font-size: 0.8125rem;
    min-height: 36px;
  }
  
  .notification-content {
    padding: 0.5rem 2.5rem 0.5rem 0.75rem;
  }
}
</style>




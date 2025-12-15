<template>
  <!-- 语言切换下拉框 -->
  <div class="language-switcher" :class="{ 'dark-mode': isDark, 'compact': compact }">
    <button 
      ref="triggerRef"
      class="lang-trigger"
      :class="{ 'is-open': isOpen }"
      @click="toggleDropdown"
    >
      <span class="lang-icon">🌐</span>
      <span class="lang-name" v-if="!compact">{{ currentLangName }}</span>
      <svg class="dropdown-arrow" :class="{ 'rotate': isOpen }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    </button>

    <Transition name="dropdown-fade">
      <div 
        v-if="isOpen" 
        ref="dropdownRef"
        class="lang-dropdown"
        :class="{ 'dropdown-up': dropUp }"
        :style="dropdownStyle"
      >
        <div class="lang-list">
          <button
            v-for="lang in languages"
            :key="lang.code"
            class="lang-item"
            :class="{ 'active': lang.code === currentLanguage }"
            @click="selectLanguage(lang.code)"
          >
            <span class="lang-item-name">{{ lang.nativeName }}</span>
            <svg v-if="lang.code === currentLanguage" class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useI18n, LANGUAGES, LANGUAGE_CODES } from '@/i18n'

const props = defineProps({
  // 是否使用紧凑模式（只显示图标）
  compact: {
    type: Boolean,
    default: false
  },
  // 是否暗色模式
  isDark: {
    type: Boolean,
    default: false
  },
  // 下拉方向：auto, up, down
  direction: {
    type: String,
    default: 'auto'
  }
})

const { currentLanguage, setLanguage } = useI18n()

const isOpen = ref(false)
const triggerRef = ref(null)
const dropdownRef = ref(null)
const dropUp = ref(false)
const dropdownPosition = ref({ top: 0, left: 0 })

// 计算下拉框样式
const dropdownStyle = computed(() => {
  if (dropUp.value) {
    return {
      bottom: `${window.innerHeight - dropdownPosition.value.top + 8}px`,
      right: `${window.innerWidth - dropdownPosition.value.right}px`
    }
  }
  return {
    top: `${dropdownPosition.value.bottom + 8}px`,
    right: `${window.innerWidth - dropdownPosition.value.right}px`
  }
})

// 构建语言列表
const languages = computed(() => {
  return LANGUAGE_CODES.map(code => ({
    code,
    ...LANGUAGES[code]
  }))
})

// 当前语言名称
const currentLangName = computed(() => {
  const lang = LANGUAGES[currentLanguage.value]
  return lang ? lang.nativeName : 'Language'
})

// 切换下拉框
function toggleDropdown() {
  if (!isOpen.value) {
    // 打开时计算位置
    updateDropdownPosition()
  }
  isOpen.value = !isOpen.value
}

// 更新下拉框位置
function updateDropdownPosition() {
  if (!triggerRef.value) return
  
  const rect = triggerRef.value.getBoundingClientRect()
  dropdownPosition.value = {
    top: rect.top,
    bottom: rect.bottom,
    left: rect.left,
    right: rect.right
  }
  
  // 计算下拉方向
  if (props.direction === 'auto') {
    checkDropdownDirection()
  } else if (props.direction === 'up') {
    dropUp.value = true
  } else {
    dropUp.value = false
  }
}

// 选择语言
async function selectLanguage(langCode) {
  await setLanguage(langCode)
  isOpen.value = false
}

// 检查下拉方向
function checkDropdownDirection() {
  if (!triggerRef.value) return
  
  const rect = triggerRef.value.getBoundingClientRect()
  const spaceBelow = window.innerHeight - rect.bottom
  const spaceAbove = rect.top
  
  // 如果下方空间不足 300px 且上方空间更大，则向上展开
  dropUp.value = props.direction === 'up' || (spaceBelow < 300 && spaceAbove > spaceBelow)
}

// 点击外部关闭
function handleClickOutside(event) {
  if (!triggerRef.value?.contains(event.target) && !dropdownRef.value?.contains(event.target)) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.language-switcher {
  position: relative;
  display: inline-block;
}

.lang-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  color: rgba(255, 255, 255, 0.85);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.lang-trigger:hover {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.2);
}

.lang-trigger.is-open {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(0, 255, 255, 0.3);
}

/* 浅色模式 */
.language-switcher:not(.dark-mode) .lang-trigger {
  background: rgba(0, 0, 0, 0.03);
  border-color: rgba(0, 0, 0, 0.08);
  color: rgba(0, 0, 0, 0.75);
}

.language-switcher:not(.dark-mode) .lang-trigger:hover {
  background: rgba(0, 0, 0, 0.06);
  border-color: rgba(0, 0, 0, 0.12);
}

.lang-icon {
  font-size: 16px;
}

.lang-name {
  font-weight: 500;
}

.dropdown-arrow {
  width: 14px;
  height: 14px;
  transition: transform 0.2s ease;
}

.dropdown-arrow.rotate {
  transform: rotate(180deg);
}

/* 紧凑模式 */
.compact .lang-trigger {
  padding: 8px;
}

/* 下拉框 */
.lang-dropdown {
  position: fixed;
  min-width: 160px;
  max-height: 400px;
  overflow-y: auto;
  background: rgba(20, 20, 35, 0.98);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  padding: 6px;
  z-index: 99999;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
}

/* dropdown-up 样式由 JS 动态计算 */

.language-switcher:not(.dark-mode) .lang-dropdown {
  background: rgba(255, 255, 255, 0.98);
  border-color: rgba(0, 0, 0, 0.08);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
}

.lang-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.lang-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.75);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;
  width: 100%;
}

.lang-item:hover {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.95);
}

.lang-item.active {
  background: rgba(0, 255, 255, 0.1);
  color: #00ffff;
}

.language-switcher:not(.dark-mode) .lang-item {
  color: rgba(0, 0, 0, 0.65);
}

.language-switcher:not(.dark-mode) .lang-item:hover {
  background: rgba(0, 0, 0, 0.04);
  color: rgba(0, 0, 0, 0.9);
}

.language-switcher:not(.dark-mode) .lang-item.active {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.lang-item-name {
  font-weight: 500;
}

.check-icon {
  width: 16px;
  height: 16px;
  color: currentColor;
}

/* 动画 */
.dropdown-fade-enter-active,
.dropdown-fade-leave-active {
  transition: all 0.2s ease;
}

.dropdown-fade-enter-from,
.dropdown-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.lang-dropdown.dropdown-up.dropdown-fade-enter-from,
.lang-dropdown.dropdown-up.dropdown-fade-leave-to {
  transform: translateY(8px);
}

/* 滚动条样式 */
.lang-dropdown::-webkit-scrollbar {
  width: 6px;
}

.lang-dropdown::-webkit-scrollbar-track {
  background: transparent;
}

.lang-dropdown::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.lang-dropdown::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

.language-switcher:not(.dark-mode) .lang-dropdown::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.15);
}

.language-switcher:not(.dark-mode) .lang-dropdown::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.25);
}
</style>


<template>
  <Transition name="banner-fade">
    <div v-if="visible" class="game-status-banner" :class="bannerClass">
      <p v-if="title" class="banner-title" :class="titleAlignClass">
        {{ title }}
      </p>
      <p v-if="subtitle" class="banner-subtitle" :class="subtitleColorClass">
        {{ subtitle }}
      </p>
    </div>
  </Transition>
</template>

<script setup lang="ts">
/**
 * Match status banner overlay.
 * Shows standby / engage / red-wins / blue-wins / draw / custom states.
 *
 * Open-sourced from the game's internal UI.
 */

import { computed, watch } from 'vue';

export type GameStatusType =
  | 'standby'
  | 'engage'
  | 'red-wins'
  | 'blue-wins'
  | 'draw'
  | 'custom';

const props = withDefaults(
  defineProps<{
    visible?: boolean;
    type?: GameStatusType;
    title?: string;
    subtitle?: string;
    autoHideDelay?: number;
  }>(),
  {
    visible: true,
    type: 'custom',
    title: '',
    subtitle: '',
    autoHideDelay: 0,
  },
);

const emit = defineEmits<{
  hide: [];
}>();

const bannerClass = computed(() => {
  switch (props.type) {
    case 'red-wins': return 'banner-red-wins';
    case 'blue-wins': return 'banner-blue-wins';
    case 'draw': return 'banner-draw';
    case 'engage': return 'banner-engage';
    case 'standby': return 'banner-standby';
    default: return '';
  }
});

const titleAlignClass = computed(() =>
  props.type === 'engage' ? 'text-center' : 'text-left',
);

const subtitleColorClass = computed(() => {
  switch (props.type) {
    case 'red-wins': return 'text-red';
    case 'blue-wins': return 'text-blue';
    default: return 'text-white';
  }
});

watch(
  () => [props.visible, props.autoHideDelay, props.type] as const,
  ([visible, delay]) => {
    if (visible && typeof delay === 'number' && delay > 0) {
      setTimeout(() => emit('hide'), delay);
    }
  },
  { immediate: true },
);
</script>

<style scoped>
.game-status-banner {
  width: 100%;
  background: rgba(0, 0, 0, 0.8);
  z-index: 9999;
  pointer-events: none;
  display: flex;
  align-items: center;
  position: relative;
  flex-direction: column;
  padding: 1.5rem 0;
}

.banner-title {
  font-size: 4.5rem;
  font-weight: 600;
  color: #ffffff;
  margin: 0;
  line-height: normal;
  white-space: nowrap;
}

.banner-subtitle {
  font-size: 3.6rem;
  font-weight: 400;
  margin: 0;
  line-height: normal;
  white-space: nowrap;
  text-align: center;
}

.banner-subtitle.text-red { color: #f33c3c; }
.banner-subtitle.text-blue { color: #3281cb; }
.banner-subtitle.text-white { color: #ffffff; }

.banner-fade-enter-active,
.banner-fade-leave-active {
  transition: all 0.5s ease;
}
.banner-fade-enter-from,
.banner-fade-leave-to {
  opacity: 0;
  transform: translateY(-100%);
}

.banner-red-wins .banner-subtitle {
  animation: red-pulse 1.5s ease-in-out infinite;
}
@keyframes red-pulse {
  0%, 100% { filter: drop-shadow(0 0 8px rgba(243, 60, 60, 0.6)); }
  50% { filter: drop-shadow(0 0 16px rgba(243, 60, 60, 1)); }
}

.banner-blue-wins .banner-subtitle {
  animation: blue-pulse 1.5s ease-in-out infinite;
}
@keyframes blue-pulse {
  0%, 100% { filter: drop-shadow(0 0 8px rgba(50, 129, 203, 0.6)); }
  50% { filter: drop-shadow(0 0 16px rgba(50, 129, 203, 1)); }
}
</style>

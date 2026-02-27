<script setup lang="ts">
import type { ParsedCat } from '~/types/save'
import { patchBirthday } from '~/utils/patch/birthday'
import { patchName } from '~/utils/patch/name'
import { setFlag } from '~/utils/patch/flags'
import { findBirthdayInfo } from '~/utils/parse/birthday'
import { readStatusFlags } from '~/utils/parse/catMeta'
import { reParseCatFromBlob } from '~/utils/parse/saveLoader'

const props = defineProps<{
  cat: ParsedCat
}>()

const { updateCat, currentDay } = useSaveEditor()

// Name editing
const editingName = ref(false)
const newName = ref('')

watch(() => props.cat.key, () => {
  editingName.value = false
  newName.value = props.cat.name
}, { immediate: true })

function startEditName() {
  newName.value = props.cat.name
  editingName.value = true
}

function applyName() {
  const trimmed = newName.value.trim()
  if (!trimmed || trimmed === props.cat.name) {
    editingName.value = false
    return
  }
  const newBlob = patchName(props.cat.decompressedBlob, props.cat.nameEndRaw, trimmed)
  const reparsed = reParseCatFromBlob(props.cat.key, newBlob, props.cat.lz4Variant, currentDay.value)
  updateCat(props.cat.key, reparsed)
  editingName.value = false
}

// Age editing
const targetAge = ref(0)
const editingAge = ref(false)

const currentAge = computed(() => {
  if (props.cat.birthdayDay === null || currentDay.value === null) return null
  return currentDay.value - props.cat.birthdayDay
})

watch(() => props.cat.key, () => {
  targetAge.value = currentAge.value ?? 0
  editingAge.value = false
}, { immediate: true })

function startEditAge() {
  targetAge.value = currentAge.value ?? 0
  editingAge.value = true
}

function applyAge() {
  if (props.cat.birthdayOffset === null || currentDay.value === null) return
  const newBirthday = currentDay.value - targetAge.value
  const newBlob = patchBirthday(props.cat.decompressedBlob, props.cat.birthdayOffset, newBirthday)
  const { birthdayDay, birthdayOffset, className } = findBirthdayInfo(newBlob, currentDay.value)
  updateCat(props.cat.key, {
    decompressedBlob: newBlob,
    birthdayDay,
    birthdayOffset,
    className
  })
  editingAge.value = false
}

// Flag editing
function toggleRetired() {
  const newVal = !props.cat.flags.retired
  const newBlob = setFlag(props.cat.decompressedBlob, props.cat.flags.offset, 0x0002, newVal)
  const flags = readStatusFlags(newBlob, props.cat.nameEndRaw)
  updateCat(props.cat.key, { decompressedBlob: newBlob, flags })
}

function toggleDead() {
  const newVal = !props.cat.flags.dead
  const newBlob = setFlag(props.cat.decompressedBlob, props.cat.flags.offset, 0x0020, newVal)
  const flags = readStatusFlags(newBlob, props.cat.nameEndRaw)
  updateCat(props.cat.key, { decompressedBlob: newBlob, flags })
}

function toggleDonated() {
  const newVal = !props.cat.flags.donated
  const newBlob = setFlag(props.cat.decompressedBlob, props.cat.flags.offset, 0x4000, newVal)
  const flags = readStatusFlags(newBlob, props.cat.nameEndRaw)
  updateCat(props.cat.key, { decompressedBlob: newBlob, flags })
}
</script>

<template>
  <div class="h-full overflow-y-auto p-6 space-y-6 max-w-md">
    <!-- Cat Info -->
    <div>
      <h3 class="text-sm font-semibold uppercase tracking-wider text-muted mb-3">
        Info
      </h3>
      <div class="space-y-2 text-sm">
        <div class="flex items-center justify-between">
          <span class="text-muted">Name</span>
          <div v-if="editingName" class="flex items-center gap-2">
            <UInput
              v-model="newName"
              size="sm"
              class="w-48"
              :maxlength="64"
              placeholder="Cat name"
              @keyup.enter="applyName"
            />
            <UButton size="md" color="primary" icon="i-lucide-check" @click="applyName" />
            <UButton size="md" color="neutral" variant="ghost" icon="i-lucide-x" @click="editingName = false" />
          </div>
          <div v-else class="flex items-center gap-2">
            <span>{{ cat.name }}</span>
            <UButton
              size="md"
              color="neutral"
              variant="ghost"
              icon="i-lucide-square-pen"
              @click="startEditName"
            />
          </div>
        </div>
        <div class="flex justify-between">
          <span class="text-muted">Sex</span>
          <span>{{ cat.sex }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-muted">Class</span>
          <span>{{ cat.className || '?' }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-muted">Key</span>
          <span class="font-mono">{{ cat.key }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-muted">ID64</span>
          <span class="font-mono text-xs">{{ cat.id64.toString() }}</span>
        </div>
      </div>
    </div>

    <!-- Age -->
    <div>
      <h3 class="text-sm font-semibold uppercase tracking-wider text-muted mb-3">
        Age
      </h3>
      <div v-if="currentAge === null" class="text-muted text-sm">
        Age data not available (missing birthday or current_day).
      </div>
      <div v-else class="space-y-2">
        <div class="flex items-center gap-3">
          <span class="text-sm text-muted">Current age:</span>
          <span class="font-medium">{{ currentAge }} days</span>
        </div>

        <div v-if="editingAge" class="flex items-center gap-2">
          <UInput
            v-model.number="targetAge"
            type="number"
            size="sm"
            class="w-32"
            :min="0"
            :max="500000"
            placeholder="Age in days"
          />
          <UButton size="md" color="primary" icon="i-lucide-check" @click="applyAge" />
          <UButton size="md" color="neutral" variant="ghost" icon="i-lucide-x" @click="editingAge = false" />
        </div>
        <UButton
          v-else
          size="md"
          color="neutral"
          variant="soft"
          icon="i-lucide-square-pen"
          label="Change Age"
          @click="startEditAge"
        />
      </div>
    </div>

    <!-- Flags -->
    <div>
      <h3 class="text-sm font-semibold uppercase tracking-wider text-muted mb-3">
        Status Flags
      </h3>
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <div>
            <div class="text-sm font-medium">Retired</div>
            <div class="text-xs text-muted">Remove retired status to make cat active again</div>
          </div>
          <USwitch :model-value="cat.flags.retired" @update:model-value="toggleRetired" />
        </div>
        <div class="flex items-center justify-between">
          <div>
            <div class="text-sm font-medium">Dead</div>
            <div class="text-xs text-muted">Toggle dead status</div>
          </div>
          <USwitch :model-value="cat.flags.dead" @update:model-value="toggleDead" />
        </div>
        <div class="flex items-center justify-between">
          <div>
            <div class="text-sm font-medium">Donated</div>
            <div class="text-xs text-muted">Toggle donated status</div>
          </div>
          <USwitch :model-value="cat.flags.donated" @update:model-value="toggleDonated" />
        </div>
      </div>
    </div>
  </div>
</template>

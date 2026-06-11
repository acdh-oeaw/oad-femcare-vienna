<script setup lang="ts">
import { ExpandIcon, SettingsIcon, ShrinkIcon, XIcon } from "lucide-vue-next";

import Data3DViewer from "@/components/data-3D-viewer.vue";

const isMobile = ref(false);
const isFullscreen = ref(false);
const screenRef = ref<HTMLElement | null>(null);

//eslint-disable-next-line @typescript-eslint/no-explicit-any
const viewerRef = ref<any>(null);
const walkingMode = ref(false);
const showControlsOverlay = ref(false);
const detailObject = ref<string | undefined>(undefined);

onMounted(() => {
	const mq = window.matchMedia("(max-width: 1024px)");

	isMobile.value = mq.matches;

	const handler = (e: MediaQueryListEvent) => {
		isMobile.value = e.matches;
	};

	mq.addEventListener("change", handler);

	onBeforeUnmount(() => {
		mq.removeEventListener("change", handler);
	});
});

const toggleMode = () => {
	walkingMode.value = !walkingMode.value;
	if (walkingMode.value) {
		showControlsOverlay.value = true;

		setTimeout(() => {
			showControlsOverlay.value = false;
		}, 2000);
	}
};

const toggleGUI = () => {
	viewerRef.value?.toggleGui();
};

const toggleFullscreen = () => {
	const el = screenRef.value!;

	if (!document.fullscreenElement) {
		el.requestFullscreen();
		isFullscreen.value = true;
	} else {
		document.exitFullscreen();
		isFullscreen.value = false;
	}
};

function setDetail(detailName: string | undefined) {
	detailObject.value = detailName;
}

function closeDetail() {
	detailObject.value = undefined;
}
</script>

<template>
	<div ref="screenRef" class="relative h-full">
		<div class="absolute z-5 right-0 m-5 flex-row flex gap-8">
			<div v-if="!isMobile && detailObject == null" class="flex items-center space-x-2">
				<Switch
					id="walking-mode"
					size="icon"
					class="bg-white hover:bg-neutral-200"
					@click="toggleMode"
				/>
				<Label for="walking-mode" class="text-white font-medium">Explore Mode</Label>
			</div>
			<Toggle v-if="detailObject == null" variant="color" size="icon" @click="toggleGUI">
				<SettingsIcon />
			</Toggle>
			<Button size="icon" class="bg-white hover:bg-neutral-200" @click="toggleFullscreen">
				<ExpandIcon v-if="!isFullscreen" class="text-black/90" />
				<ShrinkIcon v-else class="text-black/90" />
			</Button>
		</div>
		<div v-if="detailObject != null" class="absolute z-5 left-0 m-5">
			<Button size="icon" class="bg-white hover:bg-neutral-200" @click.stop="closeDetail">
				<XIcon class="text-black/90" />
			</Button>
		</div>
		<Transition
			enter-active-class="transition-all duration-500 ease-out"
			enter-from-class="opacity-0 scale-95"
			enter-to-class="opacity-100 scale-100"
			leave-active-class="transition-all duration-700 ease-in"
			leave-from-class="opacity-100 scale-100"
			leave-to-class="opacity-0 scale-105"
		>
			<div
				v-if="showControlsOverlay && walkingMode"
				class="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm"
			>
				<div class="flex items-center gap-16">
					<!-- WASD -->
					<div class="flex flex-col items-center gap-4">
						<img alt="" src="/textures/wasd.png" class="w-48 opacity-90" />
						<p class="text-lg font-medium text-white">Bewegen mit W A S D</p>
					</div>

					<!-- Mouse -->
					<div class="flex flex-col items-center gap-4">
						<img alt="" src="/textures/mouse.png" class="w-28 opacity-90" />
						<p class="text-lg font-medium text-white">Umschauen mit der Maus</p>
					</div>
				</div>
			</div>
		</Transition>
		<VisualisationContainer v-slot="{ height, width }">
			<PharmacyViewer
				v-if="height && width"
				ref="viewerRef"
				:walking-mode="walkingMode"
				:detail-on="detailObject != null"
				@detail="setDetail"
			/>
			<Data3DViewer
				v-if="height && width && detailObject != null"
				:model-name="detailObject"
			></Data3DViewer>
		</VisualisationContainer>
	</div>
</template>

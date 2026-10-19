<script setup lang="ts">
const props = defineProps<{
	path: string;
}>();

const { data: page } = await useAsyncData(
	() => `overlay-${props.path}`,
	() => queryCollection("pharmacy").path(`/pharmacy/${props.path}`).first(),
);

const modelDetail = computed(() => {
	return page.value;
});
</script>

<template>
	<div class="size-full overflow-hidden">
		<div
			v-if="modelDetail != null"
			class="absolute text-white text-sm mt-30 ml-20 w-56 sm:left-10 sm:top-10 sm:w-72"
		>
			<h1 class="text-md font-bold uppercase tracking-[0.12em] text-white/90">
				{{ modelDetail.title }}
			</h1>
			<div class="border-b border-white my-2" />
			<ContentRenderer :value="modelDetail" />
		</div>
	</div>
</template>

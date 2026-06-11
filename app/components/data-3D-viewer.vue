<script setup lang="ts">
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const props = defineProps<{
	modelName: string;
}>();

const canvasRef2 = ref<HTMLDivElement | null>(null);
const isLoading = ref(true);

const scene = new THREE.Scene();
let camera = new THREE.PerspectiveCamera();
let renderer = new THREE.WebGLRenderer();
let orbitControls: OrbitControls | null = null;

const currentModel: { modelName: string; model: THREE.Group | null } = {
	modelName: "",
	model: null,
};

// Loading Manager
const loadingManager = new THREE.LoadingManager();
loadingManager.onLoad = () => {
	isLoading.value = false;
};

loadingManager.onStart = () => {
	isLoading.value = true;
};

// GLTF Loader
const gltfLoader = new GLTFLoader(loadingManager);
gltfLoader.setMeshoptDecoder(MeshoptDecoder);

onMounted(() => {
	if (!canvasRef2.value) return;
	const canvas = canvasRef2.value;

	const sizes = {
		width: window.innerWidth,
		height: window.innerHeight,
	};

	window.addEventListener("resize", () => {
		// Update sizes
		sizes.width = window.innerWidth;
		sizes.height = window.innerHeight;

		// Update camera
		camera.aspect = sizes.width / sizes.height;
		camera.updateProjectionMatrix();

		// Update renderer
		renderer.setSize(sizes.width, sizes.height);
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
	});

	camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 100);

	scene.background = null;
	scene.add(camera);

	const ambientLight = new THREE.AmbientLight("#ffffff", 5);
	ambientLight.position.set(-4, 6.5, 2.5);
	scene.add(ambientLight);

	renderer = new THREE.WebGLRenderer({
		canvas: canvas,
		antialias: true,
		alpha: true,
	});

	renderer.setClearColor(0x000000, 0);
	renderer.setSize(sizes.width, sizes.height);
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

	// Orbit Controls
	orbitControls = new OrbitControls(camera, canvas);
	orbitControls.target.y = 3.5;
	orbitControls.target.z = 5;
	orbitControls.enableDamping = true;
	orbitControls.enableZoom = true;
	orbitControls.enablePan = true;

	const tick = () => {
		orbitControls?.update();
		renderer.render(scene, camera);
		requestAnimationFrame(tick);
	};

	tick();
});

function loadModel() {
	gltfLoader.load(`/models/pharmacy/${currentModel.modelName}.glb`, (gltf) => {
		if (currentModel.model) {
			scene.remove(currentModel.model);
		}

		const model = gltf.scene;
		currentModel.model = model;

		scene.add(model);

		const box = new THREE.Box3().setFromObject(model);
		const size = box.getSize(new THREE.Vector3());
		const center = box.getCenter(new THREE.Vector3());

		model.position.x -= center.x;
		model.position.z -= center.z;

		orbitControls?.target.set(0, 0, 0);

		const maxDim = Math.max(size.x, size.y, size.z);
		const fov = camera.fov * (Math.PI / 180);

		let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));

		cameraZ *= 1.5;

		camera.position.set(cameraZ, cameraZ * 0.6, cameraZ);
		camera.lookAt(0, 0, 0);

		camera.updateProjectionMatrix();
		orbitControls?.update();
	});
}
watch(
	() => {
		return props.modelName;
	},
	() => {
		currentModel.modelName = props.modelName;
		loadModel();
	},
	{ immediate: true },
);
</script>

<template>
	<Transition
		enter-active-class="transition-all duration-500 ease-out"
		enter-from-class="opacity-0 scale-95"
		enter-to-class="opacity-100 scale-100"
		leave-active-class="transition-all duration-700 ease-in"
		leave-from-class="opacity-100 scale-100"
		leave-to-class="opacity-0 scale-105"
	>
		<div
			v-if="props.modelName"
			class="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-none"
		></div>
	</Transition>
	<canvas ref="canvasRef2" class="absolute inset-0" />
	<Centered v-if="isLoading" class="pointer-events-none">
		<LoadingIndicator class="text-white" size="lg" />
	</Centered>
</template>

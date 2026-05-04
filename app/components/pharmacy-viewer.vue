<script setup lang="ts">
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const router = useRouter();
const route = useRoute();

const canvasRef = ref<HTMLCanvasElement | undefined>(undefined);
const isLoading = ref(true);
const isDragging = ref(false);

const currentModel: { modelName: string; model: THREE.Group | null } = {
	modelName: "room1-optimized",
	model: null,
};

const scene = new THREE.Scene();
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let controls: OrbitControls;
const placedHotspots: Array<THREE.Mesh | THREE.Sprite> = [];
const hotspotData: Array<HotspotData> = [];
let hoveredHotspot: THREE.Mesh | null = null;

interface HotspotData {
	id: string;
	position: [number, number, number];
	entityId: string;
}

// const hotspotData: Array<HotspotData> = [];
const mouse = new THREE.Vector2();
const raycaster = new THREE.Raycaster();

const loadingManager = new THREE.LoadingManager();
loadingManager.onLoad = () => {
	isLoading.value = false;
};

loadingManager.onStart = () => {
	isLoading.value = true;
};

const gltfLoader = new GLTFLoader(loadingManager);
gltfLoader.setMeshoptDecoder(MeshoptDecoder);

onMounted(() => {
	const canvas = canvasRef.value;

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

	/**
	 * Camera
	 */
	// Base camera
	camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 100);
	camera.position.set(-4.09, 3.36, -1.14); // Room 1
	//camera.position.set(2.682911163086685, 3.086072024047379, -0.8272552941557033); // Room 2
	scene.add(camera);

	// Load Initial Model
	gltfLoader.load("/models/pharmacy/room1-optimized.glb", (gltf) => {
		gltf.scene.rotation.x = -0.101592653589793;
		currentModel.model = gltf.scene;
		scene.add(gltf.scene);

		// window.addEventListener("click", (event) => {
		// 	getHotspotPosition(event);
		// });
	});

	const directionalLight = new THREE.AmbientLight("#ffffff", 1);
	directionalLight.position.set(-4, 6.5, 2.5);
	scene.add(directionalLight);

	// Controls
	controls = new OrbitControls(camera, canvas);
	controls.target.y = 3.5;
	controls.enableDamping = true;
	controls.enableZoom = false;
	controls.enablePan = false;

	/**
	 * Renderer
	 */
	renderer = new THREE.WebGLRenderer({
		canvas: canvas,
		antialias: true, // fix stair-like effect
	});
	renderer.setSize(sizes.width, sizes.height);
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

	window.addEventListener("pointermove", (event) => {
		if (canvas === undefined) return;
		const rect = canvas.getBoundingClientRect();

		const dx = event.clientX - mouse.x;
		const dy = event.clientY - mouse.y;

		if (Math.sqrt(dx * dx + dy * dy) > 5) {
			isDragging.value = true;
		}

		mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
		mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
	});

	window.addEventListener("pointerdown", (event) => {
		mouse.x = event.clientX;
		mouse.y = event.clientY;
		isDragging.value = false;
	});

	window.addEventListener("click", onClickHotspot);

	/**
	 * Animate
	 */
	const tick = () => {
		controls.update();

		// hover detection
		raycaster.setFromCamera(mouse, camera);

		const hits = raycaster.intersectObjects(placedHotspots, false);

		hoveredHotspot = hits.length ? (hits[0]?.object as THREE.Mesh) : null;

		// smooth scale animation
		placedHotspots.forEach((h) => {
			const dist = camera.position.distanceTo(h.position);
			const base = h.userData.id.includes("room") ? 0.05 : 0.08;
			let scale = dist * base;

			// apply hover multiplier
			if (h === hoveredHotspot) {
				scale *= 1.8;
			}

			const target = new THREE.Vector3(scale, scale, scale);

			h.scale.lerp(target, 0.12);
		});

		renderer.render(scene, camera);
		requestAnimationFrame(tick);
	};

	tick();
});

function createHotspot() {
	const mesh = new THREE.Mesh(
		new THREE.SphereGeometry(0.2, 16, 16),
		new THREE.MeshBasicMaterial({
			color: 0xffffff,
			depthTest: false,
		}),
	);

	return mesh;
}

function createSpriteHotspot() {
	const texture = new THREE.TextureLoader().load("/textures/door-open-circle.png");
	const material = new THREE.SpriteMaterial({
		map: texture,
		color: "#ffffff",
		transparent: true,
		depthTest: false,
	});

	const sprite = new THREE.Sprite(material);

	sprite.scale.setScalar(1);

	return sprite;
}

// New hotspot creation
// function getHotspotPosition(event: MouseEvent) {
// 	if (!currentModel.model) return;
// 	if (isDragging.value) return;

// 	const rect = canvasRef.value!.getBoundingClientRect();

// 	mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
// 	mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

// 	raycaster.setFromCamera(mouse, camera);

// 	const hits = raycaster.intersectObject(currentModel.model, true);
// 	if (!hits.length) return;

// 	const hit = hits[0];

// 	const point = hit.point.clone();
// 	const normal = hit.face?.normal?.clone();

// 	if (!normal) return;

// 	normal.transformDirection(hit.object.matrixWorld);
// 	point.add(normal.multiplyScalar(0.02));

// 	const hotspot = createHotspot();
// 	hotspot.position.copy(point);

// 	scene.add(hotspot);
// 	placedHotspots.push(hotspot);

// 	const data: HotspotData = {
// 		id: `hotspot_${hotspotData.length + 1}`,
// 		position: [point.x, point.y, point.z],
// 		entityId: "",
// 	};

// 	hotspotData.push(data);
// }

// For exporting hotspots after creating them
// function exportHotspots() {
// 	const json = JSON.stringify(hotspotData, null, 2);

// 	const blob = new Blob([json], { type: "application/json" });
// 	const url = URL.createObjectURL(blob);

// 	const a = document.createElement("a");
// 	a.href = url;
// 	a.download = "pharmacy-hotspots.json";
// 	a.click();

// 	URL.revokeObjectURL(url);
// }

function createHotspots(data: Array<HotspotData>) {
	data.forEach((item) => {
		const hotspot = item.id.includes("room") ? createSpriteHotspot() : createHotspot();

		hotspot.position.set(item.position[0], item.position[1], item.position[2]);

		hotspot.userData = item;

		if (!item.id.includes("room")) {
			const base = 0.08;
			const dist = camera.position.distanceTo(hotspot.position);

			hotspot.scale.setScalar(dist * base);
		}

		scene.add(hotspot);
		placedHotspots.push(hotspot);
	});
}

function clearHotspots() {
	for (const hotspot of placedHotspots) {
		scene.remove(hotspot);

		hotspot.geometry?.dispose();

		if (Array.isArray(hotspot.material)) {
			hotspot.material.forEach((m) => m.dispose());
		} else {
			hotspot.material?.dispose();
		}
	}

	placedHotspots.length = 0;
	hotspotData.length = 0;
}

function loadModel(modelName: string) {
	if (currentModel.model) {
		scene.remove(currentModel.model);
		currentModel.model.traverse((obj) => {
			/* eslint-disable @typescript-eslint/no-explicit-any */
			if ((obj as any).geometry) (obj as any).geometry.dispose();
			if ((obj as any).material) {
				const mat = (obj as any).material;
				if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
				else mat.dispose();
			}
			/* eslint-enable @typescript-eslint/no-explicit-any */
		});
	}

	clearHotspots();

	gltfLoader.load(`/models/pharmacy/${modelName}.glb`, (gltf) => {
		currentModel.modelName = modelName;
		currentModel.model = gltf.scene;
		if (modelName === "room1-optimized") {
			currentModel.model.rotation.x = -0.101592653589793; // center model of room 1
			camera.position.set(-4.09, 3.36, -1.14); // 2.79
		} else {
			camera.position.set(2.682911163086685, 3.086072024047379, -0.8272552941557033);
		}
		scene.add(currentModel.model);
	});
}

function onClickHotspot(event: MouseEvent) {
	const rect = canvasRef.value!.getBoundingClientRect();

	const clickMouse = new THREE.Vector2(
		((event.clientX - rect.left) / rect.width) * 2 - 1,
		-((event.clientY - rect.top) / rect.height) * 2 + 1,
	);

	raycaster.setFromCamera(clickMouse, camera);

	const hits = raycaster.intersectObjects(placedHotspots, false);
	if (!hits.length) return;

	const hotspot = hits[0]?.object as THREE.Mesh;
	const data = hotspot.userData as HotspotData;

	if (data.id === "room2") {
		loadModel("room2-optimized");
	}

	if (data.id === "room1") {
		loadModel("room1-optimized");
	}

	if (!data?.entityId) return;

	router.push({
		query: {
			...route.query,
			selection: data.entityId,
		},
	});
}

watch(isLoading, async (val) => {
	if (val === false) {
		let res;
		let hotspots;

		if (currentModel.modelName === "room1-optimized") {
			res = await fetch("/data/pharmacy-hotspots-room1.json");
			hotspots = await res.json();
		} else {
			res = await fetch("/data/pharmacy-hotspots-room2.json");
			hotspots = await res.json();
		}

		createHotspots(hotspots);
	}
});

onBeforeUnmount(() => {
	renderer?.dispose();
	controls?.dispose();
});
</script>

<template>
	<div class="relative">
		<!-- <button class="absolute top-4 left-4 bg-white text-black p-2" @click="exportHotspots">
			Export hotspots
		</button> -->

		<canvas ref="canvasRef"></canvas>

		<Centered v-if="isLoading" class="pointer-events-none">
			<LoadingIndicator class="text-white" size="lg" />
		</Centered>
	</div>
</template>

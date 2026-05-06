<script setup lang="ts">
import * as CANNON from "cannon-es";
import GUI from "lil-gui";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const router = useRouter();
const route = useRoute();

const props = defineProps<{
	walkingMode: boolean;
}>();

const canvasRef = ref<HTMLCanvasElement | undefined>(undefined);
const isLoading = ref(true);
const isDragging = ref(false);

const isPointerLocked = ref(false);

const currentModel: { modelName: string; model: THREE.Group | null } = {
	modelName: "room1-optimized",
	model: null,
};

// Physics World for Walking Mode
const world = new CANNON.World();
world.gravity.set(0, -18, 0); // -9.82

const keys = {
	w: false,
	a: false,
	s: false,
	d: false,
};

// Physics floor
const floorShape = new CANNON.Plane();
const floorBody = new CANNON.Body({ mass: 0 });
floorBody.addShape(floorShape);
floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
world.addBody(floorBody);

// Colliders
export interface WallData {
	x: number;
	y: number;
	z: number;
	sx: number;
	sy: number;
	sz: number;
	rotX?: number;
	rotY?: number;
	rotZ?: number;
}

const wallParamsList: Array<WallData> = [
	{ x: 0, y: 1.5, z: -5, sx: 10, sy: 3, sz: 0.2, rotX: 0, rotY: 0, rotZ: 0 },
	{ x: 0, y: 1.5, z: 5, sx: 10, sy: 3, sz: 0.2, rotX: 0, rotY: 0, rotZ: 0 },
	{ x: -5, y: 1.5, z: 0, sx: 0.2, sy: 3, sz: 10, rotX: 0, rotY: 0, rotZ: 0 },
	{ x: 5, y: 1.5, z: 0, sx: 0.2, sy: 3, sz: 10, rotX: 0, rotY: 0, rotZ: 0 },
];

const wallRefs: Array<ReturnType<typeof createWall>> = [];

const walls: Array<{
	body: CANNON.Body;
	debug?: THREE.Mesh;
}> = [];

// Player
const PLAYER = {
	height: 3,
	radius: 0.35,
	speed: 25,
	acceleration: 18,
	jumpForce: 6,
};

const playerBody = new CANNON.Body({
	mass: 1,
	fixedRotation: true,
	linearDamping: 0.01,
});

playerBody.addShape(new CANNON.Sphere(PLAYER.radius));
playerBody.position.set(0, PLAYER.height, 0);

world.addBody(playerBody);

const direction = new THREE.Vector3();

let gui: GUI | null = null;
const guiIsVisible = ref(false);

const scene = new THREE.Scene();

// Camera
const CAMERA_POS = {
	room1: new THREE.Vector3(-4.09, 3.36, -1.14),
	room2: new THREE.Vector3(1.04, 3.57, -0.1899999),
};
let camera: THREE.PerspectiveCamera;

let renderer: THREE.WebGLRenderer;
let orbitControls: OrbitControls | null = null;
let fpsControls: PointerLockControls | null = null;
const placedHotspots: Array<THREE.Mesh | THREE.Sprite> = [];
const hotspotData: Array<HotspotData> = [];
let hoveredHotspot: THREE.Mesh | null = null;

export interface HotspotData {
	id: string;
	position: [number, number, number];
	entityId: string;
}

// const hotspotData: Array<HotspotData> = [];
const mouse = new THREE.Vector2();
const raycaster = new THREE.Raycaster();

const ambientLight = new THREE.AmbientLight("#ffffff", 3);

// Loading Manager
const loadingManager = new THREE.LoadingManager();
loadingManager.onLoad = () => {
	isLoading.value = false;
};

loadingManager.onStart = () => {
	isLoading.value = true;
};

// GLTF Loader using MeshoptDecoder
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
	//camera.position.set(1.04, 3.57, -0.1899999);
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

	ambientLight.position.set(-4, 6.5, 2.5);

	scene.add(ambientLight);

	// Orbit Controls
	orbitControls = new OrbitControls(camera, canvas);
	orbitControls.target.y = 3.5;
	orbitControls.enableDamping = true;
	orbitControls.enableZoom = true;
	orbitControls.enablePan = true;

	// FPS Controls
	fpsControls = new PointerLockControls(camera, canvas);
	scene.add(fpsControls.object);

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

	window.addEventListener("keydown", (e) => {
		if (e.code === "KeyW" || e.code === "ArrowUp") keys.w = true;
		if (e.code === "KeyS" || e.code === "ArrowDown") keys.s = true;
		if (e.code === "KeyA" || e.code === "ArrowLeft") keys.a = true;
		if (e.code === "KeyD" || e.code === "ArrowRight") keys.d = true;
	});

	window.addEventListener("keyup", (e) => {
		if (e.code === "KeyW" || e.code === "ArrowUp") keys.w = false;
		if (e.code === "KeyS" || e.code === "ArrowDown") keys.s = false;
		if (e.code === "KeyA" || e.code === "ArrowLeft") keys.a = false;
		if (e.code === "KeyD" || e.code === "ArrowRight") keys.d = false;
	});

	fpsControls?.addEventListener("lock", () => {
		isPointerLocked.value = true;
	});

	fpsControls?.addEventListener("unlock", () => {
		isPointerLocked.value = false;
	});
	window.addEventListener("click", () => {
		if (props.walkingMode && !isPointerLocked.value) {
			fpsControls?.lock();
		}
	});
	/**
	 * GUI
	 */

	rebuildGUI();
	rebuildWalls();

	/**
	 * Animate
	 */

	const clock = new THREE.Clock();

	const tick = () => {
		if (!props.walkingMode) {
			orbitControls?.update();
		}

		const delta = Math.min(clock.getDelta(), 0.05);
		// physics step
		world.step(1 / 60, delta, 3);

		if (props.walkingMode && fpsControls?.isLocked) {
			// INPUT DIRECTION
			const forward = new THREE.Vector3();
			camera.getWorldDirection(forward);
			forward.y = 0;
			forward.normalize();

			const right = new THREE.Vector3();
			right.crossVectors(forward, new THREE.Vector3(0, 1, 0));

			direction.set(0, 0, 0);

			if (keys.w) direction.add(forward);
			if (keys.s) direction.sub(forward);
			if (keys.d) direction.add(right);
			if (keys.a) direction.sub(right);

			if (direction.lengthSq() > 0) {
				direction.normalize();
			}

			// TARGET VELOCITY
			const accel = 35; // feel free to tune 25–60

			const vel = playerBody.velocity;

			const desiredVX = direction.x * getPlayerSpeed();
			const desiredVZ = direction.z * getPlayerSpeed();

			const diffX = desiredVX - vel.x;
			const diffZ = desiredVZ - vel.z;

			vel.x += diffX * Math.min(accel * delta, 1);
			vel.z += diffZ * Math.min(accel * delta, 1);

			// CAMERA HEIGHT (realistic eyes)
			camera.position.set(
				playerBody.position.x,
				playerBody.position.y + PLAYER.height - PLAYER.radius,
				playerBody.position.z,
			);
		}
		// hover detection
		raycaster.setFromCamera(props.walkingMode ? new THREE.Vector2(0, 0) : mouse, camera);

		const hits = raycaster.intersectObjects(placedHotspots, false);

		hoveredHotspot = hits.length ? (hits[0]?.object as THREE.Mesh) : null;

		// smooth scale animation for hotspots
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

// /** New hotspot creation */
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

function resetCameraForRoom(room: string) {
	const pos = room === "room1-optimized" ? CAMERA_POS.room1 : CAMERA_POS.room2;

	camera.position.copy(pos);

	camera.rotation.set(0, 0, 0);

	orbitControls?.target.set(0, 3.5, 0);
	orbitControls?.update();

	if (fpsControls) {
		fpsControls.object.position.copy(pos);
	}
}

function createWall(params: {
	x: number;
	y: number;
	z: number;
	sx: number;
	sy: number;
	sz: number;
	rotX?: number;
	rotY?: number;
	rotZ?: number;
}) {
	const body = new CANNON.Body({ mass: 0 });

	const shape = new CANNON.Box(new CANNON.Vec3(params.sx, params.sy, params.sz));

	body.addShape(shape);

	body.position.set(params.x, params.y, params.z);

	const quat = new CANNON.Quaternion();
	quat.setFromEuler(params.rotX ?? 0, params.rotY ?? 0, params.rotZ ?? 0);

	body.quaternion.copy(quat);

	world.addBody(body);

	const mesh = new THREE.Mesh(
		new THREE.BoxGeometry(params.sx * 2, params.sy * 2, params.sz * 2),
		new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }),
		//new THREE.MeshBasicMaterial({ wireframe: true, color: "red" }),
	);

	mesh.position.set(params.x, params.y, params.z);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	mesh.quaternion.copy(body.quaternion as any);

	scene.add(mesh);

	const wall = { body, debug: mesh };
	walls.push(wall);

	return wall;
}

function rebuildWalls() {
	for (const w of wallRefs) {
		world.removeBody(w.body);
		scene.remove(w.debug!);
	}
	wallRefs.length = 0;

	for (const params of wallParamsList) {
		wallRefs.push(createWall(params));
	}
}

// function addWall() {
// 	wallParamsList.push({
// 		x: 0,
// 		y: 1.5,
// 		z: 0,
// 		sx: 20,
// 		sy: 3,
// 		sz: 0.2,
// 		rotX: 0,
// 		rotY: 0,
// 		rotZ: 0,
// 	});

// 	rebuildWalls();
// 	rebuildGUI();
// }

async function loadWalls(url: string) {
	const res = await fetch(url);
	const data = await res.json();

	wallParamsList.length = 0;
	wallParamsList.push(...data);

	rebuildWalls();
}

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

function clearWalls() {
	for (const w of wallRefs) {
		world.removeBody(w.body);

		if (w.debug) {
			scene.remove(w.debug);

			(w.debug.geometry as THREE.BufferGeometry)?.dispose();

			const mat = w.debug.material;
			if (Array.isArray(mat)) {
				mat.forEach((m) => m.dispose());
			} else {
				mat?.dispose();
			}
		}
	}

	wallRefs.length = 0;
	walls.length = 0;
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
	clearWalls();
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
			camera.position.set(1.04, 3.57, -0.1899999);
			//camera.position.set(2.682911163086685, 3.086072024047379, -0.8272552941557033);
		}

		resetCameraForRoom(modelName);

		if (props.walkingMode) {
			syncPlayerToCamera();
		}
		scene.add(currentModel.model);
	});
}

function onClickHotspot(event: MouseEvent) {
	const rect = canvasRef.value!.getBoundingClientRect();

	const useCenterRay = props.walkingMode;

	const rayOrigin = useCenterRay
		? new THREE.Vector2(0, 0)
		: new THREE.Vector2(
				((event.clientX - rect.left) / rect.width) * 2 - 1,
				-((event.clientY - rect.top) / rect.height) * 2 + 1,
			);

	raycaster.setFromCamera(rayOrigin, camera);

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

function toggleGui() {
	if (!gui) return;

	guiIsVisible.value = !guiIsVisible.value;
	gui.domElement.style.display = guiIsVisible.value ? "block" : "none";
}

function rebuildGUI() {
	if (gui) {
		gui.destroy();
	}

	gui = new GUI({ autoPlace: false, title: "Einstellungen" });

	const container = canvasRef.value?.parentElement;
	container?.appendChild(gui.domElement);

	gui.domElement.style.position = "absolute";
	gui.domElement.style.top = "80px";
	gui.domElement.style.right = "20px";

	gui.domElement.style.display = guiIsVisible.value ? "block" : "none";

	//Light
	gui.add(ambientLight, "intensity", 0.5, 6, 0.01).name("Helligkeit");

	// const cameraDebug = {
	// 	x: camera?.position.x ?? 0,
	// 	y: camera?.position.y ?? 0,
	// 	z: camera?.position.z ?? 0,
	// };

	// const camFolder = gui!.addFolder("Camera");

	// camFolder.add(cameraDebug, "x", -50, 50, 0.01).onChange(() => {
	// 	camera.position.x = cameraDebug.x;
	// });

	// camFolder.add(cameraDebug, "y", 0, 20, 0.01).onChange(() => {
	// 	camera.position.y = cameraDebug.y;
	// });

	// camFolder.add(cameraDebug, "z", -50, 50, 0.01).onChange(() => {
	// 	camera.position.z = cameraDebug.z;
	// });

	// wallParamsList.forEach((params, index) => {
	// 	const folder = gui!.addFolder(`Wall ${index + 1}`);

	// 	folder.add(params, "x", -20, 20, 0.1).onChange(rebuildWalls);
	// 	folder.add(params, "y", 0, 10, 0.1).onChange(rebuildWalls);
	// 	folder.add(params, "z", -20, 20, 0.1).onChange(rebuildWalls);

	// 	folder.add(params, "sx", 0.1, 20, 0.1).onChange(rebuildWalls);
	// 	folder.add(params, "sy", 0.1, 20, 0.1).onChange(rebuildWalls);
	// 	folder.add(params, "sz", 0.1, 20, 0.1).onChange(rebuildWalls);

	// 	folder.add(params, "rotX", -Math.PI, Math.PI, 0.01).onChange(rebuildWalls);
	// 	folder.add(params, "rotY", -Math.PI, Math.PI, 0.01).onChange(rebuildWalls);
	// 	folder.add(params, "rotZ", -Math.PI, Math.PI, 0.01).onChange(rebuildWalls);
	// });

	// gui.add({ addWall }, "addWall").name("Add Wall");
	// gui.add({ exportWalls: () => exportWalls(wallParamsList) }, "exportWalls").name("Export Walls");
}

function getPlayerSpeed() {
	return currentModel.modelName === "room1-optimized" ? 25 : 18;
}

function syncPlayerToCamera() {
	playerBody.position.set(
		camera.position.x,
		camera.position.y - PLAYER.height + PLAYER.radius,
		camera.position.z,
	);

	const dir = new THREE.Vector3();
	camera.getWorldDirection(dir);

	dir.y = 0;
	dir.normalize();
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
		loadWalls(
			currentModel.modelName === "room1-optimized"
				? "/data/pharmacy-walls-room1.json"
				: "/data/pharmacy-walls-room2.json",
		);
	}
});

watch(
	() => props.walkingMode,
	(isWalk) => {
		if (isWalk) {
			syncPlayerToCamera();
			fpsControls?.lock();
		} else {
			resetCameraForRoom(currentModel.modelName);
			fpsControls?.unlock();
		}
	},
);

onBeforeUnmount(() => {
	renderer?.dispose();
	orbitControls?.dispose();
	fpsControls?.dispose();
	gui?.destroy();
});

defineExpose({
	toggleGui,
});
</script>

<template>
	<div class="relative">
		<!-- <button class="absolute top-4 left-4 bg-white text-black p-2" @click="exportHotspots(hotspotData)">
			Export hotspots
		</button> -->

		<div
			v-if="props.walkingMode"
			class="pointer-events-none absolute top-1/2 left-1/2 z-50 size-1.5 -translate-1/2 rounded-full bg-white shadow-[0_0_8px_white]"
		/>

		<canvas ref="canvasRef"></canvas>

		<Centered v-if="isLoading" class="pointer-events-none">
			<LoadingIndicator class="text-white" size="lg" />
		</Centered>
	</div>
</template>

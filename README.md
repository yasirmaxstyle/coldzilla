# ❄️ COLDZILLA: The Kaiju With a Common Cold

An interactive 3D web experience built with **React Three Fiber (Three.js)**, **TypeScript**, and **GSAP**, featuring a low-poly procedural Kaiju struggling with sub-zero temperatures and a stuffy snout.

[Live Preview](https://yasirmaxstyle.github.io/coldzilla/)

---

## The Legend of Coldzilla (A Tragicomic Tale)

Being the King of the Monsters sounds glamorous on paper—until winter hits Tokyo Bay and you realize you are a 400-foot-tall reptile with zero access to a giant fleece blanket or a kaiju-sized mug of chamomile tea.

Last Tuesday, while dramatically emerging from the icy depths of the Pacific to roar at a passing cargo ship, Godzilla caught a draft. By Wednesday morning, the mighty terror of the deep had become **Coldzilla**. 

His dorsal fins turned frostbitten cyan. His fierce eyes drooped to a sleepy, half-lidded squint (`scale.y = 0.42`). Worst of all, his internal nuclear reactor started sputtering like an old radiator. Every **7.5 seconds**, the arctic wind drains his body temperature all the way down from a cozy **37.0°C** to a tooth-chattering **-5.0°C**. As the frost creeps over his scales, he begins to shiver uncontrollably—his knees knocking, his tiny arms trembling, and his pride completely shattered.

Pharmacies don't stock 50-ton decongestants, so Coldzilla discovered only one way to survive: **The Thermonuclear Sneeze**.

Whenever he freezes completely solid (or whenever a sympathetic human clicks on him to tickle his snout), a heroic reflex kicks in:
1. **The Big Sniffle (`inhaling`)**: He leans way back, swells his chest like a scaly balloon, opens his jaws wide, and squints in anticipation—*"Ahhhh... AHHHHH..."*
2. **The Atomic Achoo (`sneezing`)**: ***"CHOOOOO!"*** He snaps violently forward, squeezing his eyes shut as a compact burst of 198 fireball particles rockets out of his nostrils and mouth. The sheer exothermic combustion of his sneeze instantly rockets his body temperature back up to **37.0°C (100% Warmth)**!
3. **The Post-Sneeze Sniffle (`cooling`)**: Smoke puffs lazily drift up from his snout as he settles back down, briefly toasty... until the chilly breeze starts freezing him all over again.

Moral of the story: *Never fight Mothra in the rain without a scarf.*

---

## Featured Math & Procedural Animation Techniques

All modeling, rigging, thermal transitions, and particle physics in [`Godzilla.tsx`](src/components/godzilla/Godzilla.tsx) and [`Scene.tsx`](src/components/godzilla/Scene.tsx) are driven purely by code and mathematics—zero external `.gltf` models or pre-baked animations.

### 1. Sneeze Kinematics & Inverse Proportional Scaling
The sneeze sequence is a three-stage state machine (`inhaling` $\rightarrow$ `sneezing` $\rightarrow$ `cooling`) parameterized by sneeze power $s \in [0, S_{\max}]$ (where $S_{\max} = 8$ and default $s = 5.5$).

* **Inhale Expansion & Recoil (`prepareToSneeze`)**:
  During inhalation, joint rotations and torso inflation scale linearly with sneeze intensity $s$, interpolated via an overshooting cubic bezier curve (`back.out(1.7)`):
  $$\theta_{\text{torso}, x} = -0.05s, \quad \text{Scale}_{\text{torso}}(y, z) = (1 + 0.015s,\; 1 + 0.02s)$$
  $$\theta_{\text{upperJaw}, x} = -0.05s, \quad \theta_{\text{lowerJaw}, x} = 0.14s$$

* **Sneeze Impact & Inverse Eye-Squint Factor (`sneeze`)**:
  Upon sneezing, the body snaps forward ($\theta_{\text{torso}, x} = +0.04s$) while the torso compresses vertically ($\text{Scale}_{\text{torso}, y} = 1 - 0.02s$). To make stronger sneezes squeeze Coldzilla's eyes shut tighter, an **inverse normalized sneeze effect** is computed:
  $$E_{\text{sneeze}} = 1 - \frac{s}{S_{\max}}, \quad \text{Scale}_{\text{eye}, y} = 0.2 \cdot E_{\text{sneeze}}$$
  As $s \to S_{\max}$, $E_{\text{sneeze}} \to 0$, clamping the eyelids tightly closed on impact.

---

### 2. Local-to-World Coordinate Transformation & Stochastic Cone Dispersion
When Coldzilla sneezes, $\text{round}(18s)$ fire particles and $\text{round}(4s)$ post-sneeze smoke particles are emitted from inside his moving jaw (`mouthEmitterRef`).

* **Coordinate Space Transformation**:
  Because the head and torso rotate dynamically during a sneeze, particles cannot spawn at a static origin. Each particle samples a random local offset inside the mouth cavity and transforms it into world space via the emitter's $4 \times 4$ world matrix $M_{\text{world}}$:
  $$\mathbf{p}_{\text{local}} = \begin{bmatrix} (u_x - 0.5) \cdot 8 \\ (u_y - 0.5) \cdot 4 \\ 0 \\ 1 \end{bmatrix}, \quad \mathbf{p}_{\text{world}} = M_{\text{world}} \cdot \mathbf{p}_{\text{local}} \quad \text{where } u_x, u_y \sim \mathcal{U}(0, 1)$$

* **Conical Fire Trajectory**:
  Each fire particle projects forward along the $Z$-axis while spreading radially in $X$ and $Y$ proportional to the sneeze rate $s$, forming a stochastic 3D cone:
  $$\Delta Z = 32 + 8s, \quad \Delta X = (u_x - 0.5) \cdot 4.2s, \quad \Delta Y = (u_y - 0.5) \cdot 3.5s - 4$$
  $$\text{Duration} = (0.75 + 0.12s) \cdot R_{\text{speed}}, \quad \text{Scale}_{\max} = 1.15s$$

* **sRGB-to-Linear Blackbody Color Cooling**:
  As fire particles travel outward, their RGB values interpolate across 4 thermal keyframes (bright yellow $\rightarrow$ orange $\rightarrow$ crimson $\rightarrow$ dark ash) and undergo gamma correction ($\text{sRGB} \to \text{Linear}$) every frame for physically accurate shading under Three.js lighting.

---

### 3. Thermal Decay & Multi-Material Color Interpolation (`lerpColors`)
Coldzilla's internal warmth $T \in [0, 100]$ decays linearly with frame delta time $\Delta t$:
$$T(t + \Delta t) = \max\left(0,\; T(t) - 13.5 \cdot \Delta t\right)$$
At $13.5\text{ units/sec}$, Coldzilla freezes from $100\%$ to $0\%$ in $\approx 7.41\text{ seconds}$, triggering `prepareToSneeze()` automatically at $T \le 0$.

A normalized **Cold Factor** $\alpha_{\text{cold}} \in [0, 1]$ drives real-time linear interpolation (`lerpColors`) across four material palettes (skin, belly plates, dorsal spines, and dark details), while simultaneously mapping to the HUD thermometer in degrees Celsius:
$$\alpha_{\text{cold}} = 1 - \frac{T}{100}, \quad \mathbf{C}_{\text{mat}} = (1 - \alpha_{\text{cold}})\mathbf{C}_{\text{warm}} + \alpha_{\text{cold}}\mathbf{C}_{\text{cold}}$$
$$T_{\text{Celsius}} = -5.0 + \left(\frac{T}{100}\right) \times 42.0 \quad \in [-5.0^\circ\text{C},\; 37.0^\circ\text{C}]$$

---

### 4. Amplitude-Modulated Harmonic Oscillations (Shivering & Breathing)
When idle (`!isSneezing`), Coldzilla combines low-frequency breathing with high-frequency shivering whose amplitude is modulated directly by $\alpha_{\text{cold}}$:

* **High-Frequency Thermal Shivering**:
  Using orthogonal trigonometric functions ($\sin$ for lateral translation at $\omega = 48\text{ rad/s}$, $\cos$ for axial tilt at $\omega = 42\text{ rad/s}$) prevents robotic phase-locking and creates organic trembling as $\alpha_{\text{cold}} \to 1$:
  $$x_{\text{shiver}}(t) = 2.2 \cdot \alpha_{\text{cold}} \cdot \sin(48t), \quad \theta_{z,\text{shiver}}(t) = 0.025 \cdot \alpha_{\text{cold}} \cdot \cos(42t)$$

* **Low-Frequency Breathing & Tail Sway**:
  $$y_{\text{torso}}(t) = 60 + 1.5 \sin(2t), \quad \theta_{y,\text{tail}}(t) = 0.08 \sin(1.5t)$$

* **Counter-Phase Arm Tremors**:
  Left and right arms oscillate $180^\circ$ out of phase during breathing while amplifying the axial shiver:
  $$\theta_{x,\text{armL}}(t) = 0.4 + 0.08\sin(3t) + 2\theta_{z,\text{shiver}}(t)$$
  $$\theta_{x,\text{armR}}(t) = 0.4 - 0.08\sin(3t) - 2\theta_{z,\text{shiver}}(t)$$

---

### 5. Exponential Smoothing (Damped Pointer Tracking)
As the user moves their cursor (`pointer.x`, `pointer.y` $\in [-1, 1]$), Coldzilla turns his upper and lower body toward the pointer using discrete-time exponential smoothing (`THREE.MathUtils.lerp`):
$$\theta_{\text{current}} \leftarrow \theta_{\text{current}} + k \cdot (\theta_{\text{target}} - \theta_{\text{target\_prev}}), \quad k \in \{0.05, 0.10\}$$
where the target rotation blends cursor coordinates with the active shiver tremor:
$$\theta_{\text{target}, z} = -0.08 \cdot p_x + \theta_{z,\text{shiver}}(t)$$

---

### 6. Procedural Geometry & Shear Deformation
Instead of loading external 3D assets, Coldzilla's body parts are constructed from low-poly 4-sided cylinders (`CylinderGeometry(rTop, rBottom, height, 4, 1)`) rotated by $\frac{\pi}{4}$ radians ($45^\circ$) around the $Y$-axis to align flat faces forward:
* **Torso Forward Lean (Vertex Shear Transformation)**:
  Every vertex $i$ in the upper half of the torso mesh ($y_i > 0$) is translated forward along $Z$ by $+16$ units before recomputing vertex normals (`computeVertexNormals()`), giving Coldzilla his signature hunched kaiju posture:
  $$\forall i \text{ where } y_i > 0: \quad z_i' = z_i + 16$$

* **Modulo-Arithmetic Blinking**:
  Sleepy blinking uses a periodic step function evaluated via modulo arithmetic every $3.5\text{ seconds}$ for a $0.18\text{s}$ blink window:
  $$\text{Scale}_{\text{eye}, y}(t) = \begin{cases} 0.08 & \text{if } (t \bmod 3.5) > 3.32 \\ 0.42 & \text{otherwise} \end{cases}$$

---

## Tech Stack

* **[React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)** — Component architecture & strict typing
* **[Three.js](https://threejs.org/) + [@react-three/fiber](https://r3f.docs.pmnd.rs/)** — Declarative WebGL scene graph & `useFrame` render loop
* **[@react-three/drei](https://drei.docs.pmnd.rs/)** — Camera `OrbitControls`
* **[GSAP (GreenSock)](https://gsap.com/)** — Timeline & keyframe tweening for sneeze kinematics and particle lifecycle
* **[Vite](https://vite.dev/)** — Fast HMR bundler

---

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### Controls
* **Click on Coldzilla**: Force an immediate thermonuclear sneeze to warm him up!
* **Move Mouse**: Coldzilla tracks your cursor while shivering.
* **Drag / Scroll**: Orbit and zoom around the icy stage.

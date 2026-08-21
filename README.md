# 🛗 Smart Elevator — Deterministic Finite Automaton (DFA) Simulator

> **A Complete Real-Time Collective Control Finite Automaton $M = (Q, \Sigma, \delta, q_0, F)$**  
> Developed for **Finite Automata and Formal Languages (FAFL)** — **In Semester Evaluation (ISE)**.

---

## 🏛️ Academic & Project Information

* **Course**: Finite Automata and Formal Languages
* **Evaluation**: In Semester Evaluation (ISE) Project
* **Department**: Department of Computer Science and Engineering
* **Course Instructor & Project Guide**: **Professor Mrs. G. G. Shingan**

### 👥 Project Team Members
1. **Harshwardhan Patil** (CSE)
2. **Aditi Nikam** (CSE)
3. **Navami Bhat** (CSE)
4. **Ruturaj Lokhande** (CSE)
5. **Yogita Patil** (CSE)

---

## 🚀 Live Demo & Deployment
Open `index.html` in any web browser or deploy directly via **GitHub Pages**.

---

## 📐 Formal 5-Tuple Mathematical Definition

$$M = (Q, \Sigma, \delta, q_0, F)$$

### 1. Finite State Set ($Q$)
A composite 5-tuple configuration:
$$q = (\text{Floor}, \text{Door}, \text{Direction}, \text{Requests}, \text{Mode})$$
* **Floor** $\in \{1, 2, 3, 4\}$
* **Door** $\in \{\text{CLOSED}, \text{OPEN}\}$
* **Direction** $\in \{\text{IDLE}, \text{UP}, \text{DOWN}\}$
* **Requests** $\in \mathcal{P}(\text{Requests}) \cong [0, 1023]$ (10-bit bitmask)
* **Mode** $\in \{\text{NORMAL}, \text{EMERGENCY}\}$
* **Reachable Valid State Space**: $> 5,000$ deterministic operational configurations.

### 2. Input Alphabet ($\Sigma$) — 17 Symbols
$$\Sigma = \{ U, D, O, C, T, E, R, \text{REQ\_CABIN\_1..4}, \text{REQ\_HALL\_1..3\_UP}, \text{REQ\_HALL\_2..4\_DOWN} \}$$

### 3. Initial State ($q_0$)
$$q_0 = (\text{Floor 1}, \text{CLOSED}, \text{IDLE}, \emptyset, \text{NORMAL})$$

### 4. Accepting / Safe States ($F$)
$$F = \{ q \in Q \mid q.\text{Mode} = \text{NORMAL} \}$$

### 5. Transition Function ($\delta: Q \times \Sigma \rightarrow Q$)
A total deterministic transition function executing SCAN collective scheduling without passenger starvation.

---

## 🛠️ Technology Stack
* **HTML5**: Semantic single-page layout & SVG 2.0 DOM elements.
* **CSS3**: Hardware-accelerated glassmorphism dark theme & cubic-bezier transitions.
* **Vanilla JavaScript (ES6+)**: Formal DFA mathematical engine & bitmask state dispatcher.
* **Web Audio API**: Algorithmic audio synthesis (chimes, 60Hz motor hum, 880Hz emergency sirens).
* **Node.js**: Automated test suite runner (`test_dfa_engine.js`).

---

## 🧪 Automated Unit Test Verification
To run the 13 automated formal unit tests verifying determinism, boundary self-loops, and SCAN scheduling:
```bash
node test_dfa_engine.js
```

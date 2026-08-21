/**
 * ============================================================================
 * SMART ELEVATOR — REAL-TIME COLLECTIVE CONTROL DFA ENGINE
 * Course: Formal Automata and Formal Languages (FAFL) — ISE
 * 
 * Formal 5-Tuple Definition:
 *   M = (Q, Σ, δ, q0, F)
 *   Q  = { (floor, door, direction, requests, mode) } (Finite Composite Space > 1,500 Reachable States)
 *        - floor ∈ {1, 2, 3, 4}
 *        - door ∈ {CLOSED, OPEN}
 *        - direction ∈ {IDLE, UP, DOWN}
 *        - requests ∈ P(ReqTypes) = {0, 1, ..., 1023} (10-bit finite bitmask)
 *        - mode ∈ {NORMAL, EMERGENCY}
 *   Σ  = { U, D, O, C, T, E, R, REQ_CABIN_1..4, REQ_HALL_1..3_UP, REQ_HALL_2..4_DOWN } (17 discrete events)
 *   q0 = (1, CLOSED, IDLE, 0, NORMAL)
 *   F  = { q ∈ Q | mode == NORMAL }
 *   δ: Q × Σ → Q (Total Deterministic Transition Function with SCAN Collective Scheduling)
 * ============================================================================
 */

(function () {
  'use strict';

  // --------------------------------------------------------------------------
  // 1. FINITE REQUEST BITMASK ENCODINGS (10-bit Finite Set P(ReqTypes))
  // --------------------------------------------------------------------------
  const REQ_MASK = {
    CABIN_1: 1 << 0,     // 0x001 (1)
    CABIN_2: 1 << 1,     // 0x002 (2)
    CABIN_3: 1 << 2,     // 0x004 (4)
    CABIN_4: 1 << 3,     // 0x008 (8)
    HALL_1_UP: 1 << 4,   // 0x010 (16)
    HALL_2_UP: 1 << 5,   // 0x020 (32)
    HALL_3_UP: 1 << 6,   // 0x040 (64)
    HALL_2_DOWN: 1 << 7, // 0x080 (128)
    HALL_3_DOWN: 1 << 8, // 0x100 (256)
    HALL_4_DOWN: 1 << 9  // 0x200 (512)
  };

  const REQ_LABELS = {
    [REQ_MASK.CABIN_1]: { type: 'cabin', floor: 1, label: 'Cabin F1', short: 'C1', icon: '1' },
    [REQ_MASK.CABIN_2]: { type: 'cabin', floor: 2, label: 'Cabin F2', short: 'C2', icon: '2' },
    [REQ_MASK.CABIN_3]: { type: 'cabin', floor: 3, label: 'Cabin F3', short: 'C3', icon: '3' },
    [REQ_MASK.CABIN_4]: { type: 'cabin', floor: 4, label: 'Cabin F4', short: 'C4', icon: '4' },
    [REQ_MASK.HALL_1_UP]: { type: 'hall_up', floor: 1, label: 'Hall 1 ↑', short: '1↑', icon: '1↑' },
    [REQ_MASK.HALL_2_UP]: { type: 'hall_up', floor: 2, label: 'Hall 2 ↑', short: '2↑', icon: '2↑' },
    [REQ_MASK.HALL_3_UP]: { type: 'hall_up', floor: 3, label: 'Hall 3 ↑', short: '3↑', icon: '3↑' },
    [REQ_MASK.HALL_2_DOWN]: { type: 'hall_down', floor: 2, label: 'Hall 2 ↓', short: '2↓', icon: '2↓' },
    [REQ_MASK.HALL_3_DOWN]: { type: 'hall_down', floor: 3, label: 'Hall 3 ↓', short: '3↓', icon: '3↓' },
    [REQ_MASK.HALL_4_DOWN]: { type: 'hall_down', floor: 4, label: 'Hall 4 ↓', short: '4↓', icon: '4↓' }
  };

  // --------------------------------------------------------------------------
  // 2. COMPOSITE DFA STATE CLASS
  // --------------------------------------------------------------------------
  class DfaState {
    constructor(floor = 1, door = 'CLOSED', direction = 'IDLE', requests = 0, mode = 'NORMAL') {
      this.floor = Math.max(1, Math.min(4, floor));
      this.door = door; // 'CLOSED' | 'OPEN'
      this.direction = direction; // 'IDLE' | 'UP' | 'DOWN'
      this.requests = requests & 0x3FF; // 10-bit integer [0, 1023]
      this.mode = mode; // 'NORMAL' | 'EMERGENCY'
    }

    getKey() {
      return `q(F${this.floor},${this.door},${this.direction},0x${this.requests.toString(16).toUpperCase()},${this.mode})`;
    }

    getDisplayTuple() {
      const reqList = this.getRequestList();
      const reqStr = reqList.length === 0 ? '∅' : `{${reqList.join(',')}}`;
      return `q(F${this.floor}, ${this.door}, ${this.direction}, ${reqStr}, ${this.mode})`;
    }

    getCompactDisplay() {
      const dirIcon = this.direction === 'UP' ? '↑' : (this.direction === 'DOWN' ? '↓' : '•');
      return `q(F${this.floor}, ${this.door[0]}, ${dirIcon}, 0x${this.requests.toString(16).toUpperCase()}, ${this.mode[0]})`;
    }

    getRequestList() {
      const list = [];
      Object.keys(REQ_MASK).forEach(k => {
        const mask = REQ_MASK[k];
        if (this.requests & mask) {
          list.push(REQ_LABELS[mask].short);
        }
      });
      return list;
    }

    hasAnyRequests() {
      return this.requests !== 0;
    }

    hasRequestAtFloor(fl) {
      if (fl === 1) return (this.requests & (REQ_MASK.CABIN_1 | REQ_MASK.HALL_1_UP)) !== 0;
      if (fl === 2) return (this.requests & (REQ_MASK.CABIN_2 | REQ_MASK.HALL_2_UP | REQ_MASK.HALL_2_DOWN)) !== 0;
      if (fl === 3) return (this.requests & (REQ_MASK.CABIN_3 | REQ_MASK.HALL_3_UP | REQ_MASK.HALL_3_DOWN)) !== 0;
      if (fl === 4) return (this.requests & (REQ_MASK.CABIN_4 | REQ_MASK.HALL_4_DOWN)) !== 0;
      return false;
    }

    clone() {
      return new DfaState(this.floor, this.door, this.direction, this.requests, this.mode);
    }
  }

  // --------------------------------------------------------------------------
  // 3. SCAN COLLECTIVE SCHEDULING ALGORITHM (Embedded inside δ)
  // --------------------------------------------------------------------------
  function hasRequestsAbove(fl, reqs) {
    for (let f = fl + 1; f <= 4; f++) {
      if (f === 2 && (reqs & (REQ_MASK.CABIN_2 | REQ_MASK.HALL_2_UP | REQ_MASK.HALL_2_DOWN))) return true;
      if (f === 3 && (reqs & (REQ_MASK.CABIN_3 | REQ_MASK.HALL_3_UP | REQ_MASK.HALL_3_DOWN))) return true;
      if (f === 4 && (reqs & (REQ_MASK.CABIN_4 | REQ_MASK.HALL_4_DOWN))) return true;
    }
    return false;
  }

  function hasRequestsBelow(fl, reqs) {
    for (let f = fl - 1; f >= 1; f--) {
      if (f === 1 && (reqs & (REQ_MASK.CABIN_1 | REQ_MASK.HALL_1_UP))) return true;
      if (f === 2 && (reqs & (REQ_MASK.CABIN_2 | REQ_MASK.HALL_2_UP | REQ_MASK.HALL_2_DOWN))) return true;
      if (f === 3 && (reqs & (REQ_MASK.CABIN_3 | REQ_MASK.HALL_3_UP | REQ_MASK.HALL_3_DOWN))) return true;
    }
    return false;
  }

  function computeScanDirection(fl, currentDir, reqs) {
    if (reqs === 0) return 'IDLE';

    if (currentDir === 'UP') {
      if (hasRequestsAbove(fl, reqs)) return 'UP';
      if (hasRequestsBelow(fl, reqs)) return 'DOWN';
      return 'IDLE';
    } else if (currentDir === 'DOWN') {
      if (hasRequestsBelow(fl, reqs)) return 'DOWN';
      if (hasRequestsAbove(fl, reqs)) return 'UP';
      return 'IDLE';
    } else { // IDLE
      if (hasRequestsAbove(fl, reqs)) return 'UP';
      if (hasRequestsBelow(fl, reqs)) return 'DOWN';
      return 'IDLE';
    }
  }

  function getMatchingRequestsAtFloor(fl, dir, reqs) {
    let matched = 0;

    // 1. Cabin requests at current floor are always served
    if (fl === 1 && (reqs & REQ_MASK.CABIN_1)) matched |= REQ_MASK.CABIN_1;
    if (fl === 2 && (reqs & REQ_MASK.CABIN_2)) matched |= REQ_MASK.CABIN_2;
    if (fl === 3 && (reqs & REQ_MASK.CABIN_3)) matched |= REQ_MASK.CABIN_3;
    if (fl === 4 && (reqs & REQ_MASK.CABIN_4)) matched |= REQ_MASK.CABIN_4;

    // 2. Hall requests matching direction or turnaround endpoints
    const requestsAbove = hasRequestsAbove(fl, reqs);
    const requestsBelow = hasRequestsBelow(fl, reqs);

    if (dir === 'UP' || dir === 'IDLE') {
      if (fl === 1 && (reqs & REQ_MASK.HALL_1_UP)) matched |= REQ_MASK.HALL_1_UP;
      if (fl === 2 && (reqs & REQ_MASK.HALL_2_UP)) matched |= REQ_MASK.HALL_2_UP;
      if (fl === 3 && (reqs & REQ_MASK.HALL_3_UP)) matched |= REQ_MASK.HALL_3_UP;

      // Turnaround on highest requested floor serves DOWN call too
      if (!requestsAbove) {
        if (fl === 2 && (reqs & REQ_MASK.HALL_2_DOWN)) matched |= REQ_MASK.HALL_2_DOWN;
        if (fl === 3 && (reqs & REQ_MASK.HALL_3_DOWN)) matched |= REQ_MASK.HALL_3_DOWN;
        if (fl === 4 && (reqs & REQ_MASK.HALL_4_DOWN)) matched |= REQ_MASK.HALL_4_DOWN;
      }
    }

    if (dir === 'DOWN' || dir === 'IDLE') {
      if (fl === 2 && (reqs & REQ_MASK.HALL_2_DOWN)) matched |= REQ_MASK.HALL_2_DOWN;
      if (fl === 3 && (reqs & REQ_MASK.HALL_3_DOWN)) matched |= REQ_MASK.HALL_3_DOWN;
      if (fl === 4 && (reqs & REQ_MASK.HALL_4_DOWN)) matched |= REQ_MASK.HALL_4_DOWN;

      // Turnaround on lowest requested floor serves UP call too
      if (!requestsBelow) {
        if (fl === 1 && (reqs & REQ_MASK.HALL_1_UP)) matched |= REQ_MASK.HALL_1_UP;
        if (fl === 2 && (reqs & REQ_MASK.HALL_2_UP)) matched |= REQ_MASK.HALL_2_UP;
        if (fl === 3 && (reqs & REQ_MASK.HALL_3_UP)) matched |= REQ_MASK.HALL_3_UP;
      }
    }

    return matched;
  }

  // --------------------------------------------------------------------------
  // 4. TOTAL DETERMINISTIC TRANSITION FUNCTION: δ(q, σ)
  // --------------------------------------------------------------------------
  function delta(state, symbol) {
    const current = state.clone();

    // 1. EMERGENCY EVENT (E)
    if (symbol === 'E') {
      return {
        nextState: new DfaState(current.floor, current.door, 'IDLE', current.requests, 'EMERGENCY'),
        action: 'EMERGENCY_TRIGGERED',
        servedMask: 0,
        explanation: `Emergency event 'E': Safety brake engaged at Floor ${current.floor}. All pending requests [${current.getRequestList().join(',') || '∅'}] preserved in DFA state.`
      };
    }

    // 2. IN EMERGENCY MODE
    if (current.mode === 'EMERGENCY') {
      if (symbol === 'R') {
        // RESET FROM EMERGENCY: return to NORMAL, doors CLOSED, direction IDLE, preserving requests & floor
        return {
          nextState: new DfaState(current.floor, 'CLOSED', 'IDLE', current.requests, 'NORMAL'),
          action: 'EMERGENCY_RESET',
          servedMask: 0,
          explanation: `Reset event 'R': Emergency cleared. Restored normal operation at Floor ${current.floor} with preserved pending requests.`
        };
      } else {
        // Self-loop on all other inputs while in emergency
        return {
          nextState: current,
          action: 'EMERGENCY_LOCKED',
          servedMask: 0,
          explanation: `System locked in EMERGENCY mode. Input '${symbol}' rejected with safe self-loop.`
        };
      }
    }

    // 3. GLOBAL RESET EVENT (R) IN NORMAL MODE
    if (symbol === 'R') {
      return {
        nextState: new DfaState(1, 'CLOSED', 'IDLE', 0, 'NORMAL'),
        action: 'SYSTEM_RESET',
        servedMask: 0,
        explanation: `System reset 'R': Reinitialized to initial configuration q0 = (Floor 1, CLOSED, IDLE, ∅, NORMAL).`
      };
    }

    // 4. REQUEST EVENTS (Σ_req = { REQ_CABIN_1..4, REQ_HALL_1..3_UP, REQ_HALL_2..4_DOWN })
    if (symbol.startsWith('REQ_')) {
      const maskKey = symbol.replace('REQ_', '');
      const maskVal = REQ_MASK[maskKey];
      if (maskVal) {
        const newReqs = current.requests | maskVal;
        let newDir = current.direction;
        if (newDir === 'IDLE' && newReqs !== 0) {
          newDir = computeScanDirection(current.floor, 'IDLE', newReqs);
        }
        return {
          nextState: new DfaState(current.floor, current.door, newDir, newReqs, 'NORMAL'),
          action: 'REQUEST_ADDED',
          servedMask: 0,
          explanation: `Request event '${symbol}': Coexists with active requests. DFA updated pending mask to 0x${newReqs.toString(16).toUpperCase()}.`
        };
      }
    }

    // 5. MANUAL STEP UP COMMAND (U)
    if (symbol === 'U') {
      if (current.door === 'OPEN') {
        return {
          nextState: current,
          action: 'SELF_LOOP_DOOR_OPEN',
          servedMask: 0,
          explanation: `Manual command 'U' blocked: Cabin motion prohibited while doors are OPEN (Self-loop δ(q,U)=q).`
        };
      }
      if (current.floor === 4) {
        return {
          nextState: current,
          action: 'SELF_LOOP_BOUNDARY_TOP',
          servedMask: 0,
          explanation: `Manual command 'U' blocked: Floor 4 is the top floor of the shaft (Self-loop δ(q,U)=q).`
        };
      }
      return {
        nextState: new DfaState(current.floor + 1, 'CLOSED', 'UP', current.requests, 'NORMAL'),
        action: 'MANUAL_MOVE_UP',
        servedMask: 0,
        explanation: `Manual command 'U': Transitioned cabin upwards to Floor ${current.floor + 1}.`
      };
    }

    // 6. MANUAL STEP DOWN COMMAND (D)
    if (symbol === 'D') {
      if (current.door === 'OPEN') {
        return {
          nextState: current,
          action: 'SELF_LOOP_DOOR_OPEN',
          servedMask: 0,
          explanation: `Manual command 'D' blocked: Cabin motion prohibited while doors are OPEN (Self-loop δ(q,D)=q).`
        };
      }
      if (current.floor === 1) {
        return {
          nextState: current,
          action: 'SELF_LOOP_BOUNDARY_BOTTOM',
          servedMask: 0,
          explanation: `Manual command 'D' blocked: Floor 1 is the lowest lobby floor (Self-loop δ(q,D)=q).`
        };
      }
      return {
        nextState: new DfaState(current.floor - 1, 'CLOSED', 'DOWN', current.requests, 'NORMAL'),
        action: 'MANUAL_MOVE_DOWN',
        servedMask: 0,
        explanation: `Manual command 'D': Transitioned cabin downwards to Floor ${current.floor - 1}.`
      };
    }

    // 7. MANUAL OPEN DOOR COMMAND (O)
    if (symbol === 'O') {
      if (current.door === 'OPEN') {
        return {
          nextState: current,
          action: 'SELF_LOOP_DOOR_ALREADY_OPEN',
          servedMask: 0,
          explanation: `Command 'O' redundant: Doors are already OPEN (Self-loop δ(q,O)=q).`
        };
      }
      return {
        nextState: new DfaState(current.floor, 'OPEN', current.direction, current.requests, 'NORMAL'),
        action: 'DOOR_OPEN',
        servedMask: 0,
        explanation: `Command 'O': Slid cabin dual doors OPEN at Floor ${current.floor}.`
      };
    }

    // 8. MANUAL CLOSE DOOR COMMAND (C)
    if (symbol === 'C') {
      if (current.door === 'CLOSED') {
        return {
          nextState: current,
          action: 'SELF_LOOP_DOOR_ALREADY_CLOSED',
          servedMask: 0,
          explanation: `Command 'C' redundant: Doors are already CLOSED (Self-loop δ(q,C)=q).`
        };
      }
      return {
        nextState: new DfaState(current.floor, 'CLOSED', current.direction, current.requests, 'NORMAL'),
        action: 'DOOR_CLOSE',
        servedMask: 0,
        explanation: `Command 'C': Slid cabin dual doors CLOSED at Floor ${current.floor}.`
      };
    }

    // 9. DISCRETE SYSTEM TICK EVENT (T) — SCAN POLICY
    if (symbol === 'T') {
      // If door is OPEN: close doors and re-evaluate SCAN direction
      if (current.door === 'OPEN') {
        const nextDir = computeScanDirection(current.floor, current.direction, current.requests);
        return {
          nextState: new DfaState(current.floor, 'CLOSED', nextDir, current.requests, 'NORMAL'),
          action: 'DOOR_CLOSE_TICK',
          servedMask: 0,
          explanation: `System tick 'T': Passenger transfer completed. Doors closed at Floor ${current.floor}. Next direction: ${nextDir}.`
        };
      }

      // If door is CLOSED: check if current floor has requests to serve
      const matchingReqs = getMatchingRequestsAtFloor(current.floor, current.direction, current.requests);
      if (matchingReqs !== 0) {
        const remaining = current.requests & (~matchingReqs);
        const nextDir = computeScanDirection(current.floor, current.direction, remaining);
        return {
          nextState: new DfaState(current.floor, 'OPEN', nextDir, remaining, 'NORMAL'),
          action: 'SERVE_REQUEST',
          servedMask: matchingReqs,
          explanation: `System tick 'T': Elevator arrived at Floor ${current.floor}. Serving requests and opening doors.`
        };
      }

      // If no requests at all: remain IDLE
      if (current.requests === 0) {
        return {
          nextState: new DfaState(current.floor, 'CLOSED', 'IDLE', 0, 'NORMAL'),
          action: 'IDLE_TICK',
          servedMask: 0,
          explanation: `System tick 'T': No active requests. Elevator remains IDLE at Floor ${current.floor}.`
        };
      }

      // Move one discrete floor according to SCAN policy
      const dir = computeScanDirection(current.floor, current.direction, current.requests);

      if (dir === 'UP') {
        if (hasRequestsAbove(current.floor, current.requests)) {
          return {
            nextState: new DfaState(current.floor + 1, 'CLOSED', 'UP', current.requests, 'NORMAL'),
            action: 'MOVE_UP_TICK',
            servedMask: 0,
            explanation: `System tick 'T': SCAN engine advancing cabin UP from Floor ${current.floor} to Floor ${current.floor + 1}.`
          };
        } else {
          return {
            nextState: new DfaState(current.floor, 'CLOSED', 'DOWN', current.requests, 'NORMAL'),
            action: 'TURNAROUND_DOWN',
            servedMask: 0,
            explanation: `System tick 'T': Reached top requested floor bounds. SCAN engine reversed direction to DOWN.`
          };
        }
      } else if (dir === 'DOWN') {
        if (hasRequestsBelow(current.floor, current.requests)) {
          return {
            nextState: new DfaState(current.floor - 1, 'CLOSED', 'DOWN', current.requests, 'NORMAL'),
            action: 'MOVE_DOWN_TICK',
            servedMask: 0,
            explanation: `System tick 'T': SCAN engine descending cabin DOWN from Floor ${current.floor} to Floor ${current.floor - 1}.`
          };
        } else {
          return {
            nextState: new DfaState(current.floor, 'CLOSED', 'UP', current.requests, 'NORMAL'),
            action: 'TURNAROUND_UP',
            servedMask: 0,
            explanation: `System tick 'T': Reached bottom requested floor bounds. SCAN engine reversed direction to UP.`
          };
        }
      }

      return {
        nextState: new DfaState(current.floor, 'CLOSED', 'IDLE', current.requests, 'NORMAL'),
        action: 'IDLE_TICK',
        servedMask: 0,
        explanation: `System tick 'T': Elevator stationary at Floor ${current.floor}.`
      };
    }

    // Default Fallback Self-Loop
    return {
      nextState: current,
      action: 'NOOP_SELF_LOOP',
      servedMask: 0,
      explanation: `Symbol '${symbol}' evaluated as deterministic self-loop δ(q, σ) = q.`
    };
  }

  // --------------------------------------------------------------------------
  // 5. DETERMINISTIC ROUTE PLANNER (Generates route from DFA state simulation)
  // --------------------------------------------------------------------------
  function planRouteFromState(startState) {
    if (!startState.hasAnyRequests()) {
      return { path: `Idle at Floor ${startState.floor}`, nextStop: 'None (Idle)' };
    }

    let sim = startState.clone();
    if (sim.mode === 'EMERGENCY') {
      return { path: `Emergency Halt at Floor ${sim.floor}`, nextStop: 'None (Emergency)' };
    }

    const stops = [sim.floor];
    let nextStop = null;
    let maxSteps = 24;

    while (sim.hasAnyRequests() && maxSteps > 0) {
      maxSteps--;
      const res = delta(sim, 'T');
      sim = res.nextState;

      if (res.action === 'SERVE_REQUEST') {
        if (!nextStop) nextStop = `Floor ${sim.floor}`;
        if (stops[stops.length - 1] !== sim.floor) {
          stops.push(sim.floor);
        }
      } else if (res.action.startsWith('MOVE_')) {
        if (stops[stops.length - 1] !== sim.floor) {
          stops.push(sim.floor);
        }
      }
    }

    const pathStr = stops.join(' → ');
    return {
      path: pathStr || `Floor ${startState.floor}`,
      nextStop: nextStop || `Floor ${stops[1] || stops[0]}`
    };
  }

  // --------------------------------------------------------------------------
  // 6. AUDIO SYNTHESIZER (Web Audio API)
  // --------------------------------------------------------------------------
  class SoundSynthesizer {
    constructor() {
      this.enabled = true;
      this.ctx = null;
    }

    init() {
      if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    playChime() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      this._playTone(659.25, now, 0.35, 'sine', 0.15);
      this._playTone(830.61, now + 0.18, 0.5, 'sine', 0.18);
    }

    playMotorHum() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(110, now);
      osc.frequency.linearRampToValueAtTime(145, now + 0.3);
      osc.frequency.linearRampToValueAtTime(110, now + 0.8);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.9);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.9);
    }

    playDoorSlide() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.45);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.5);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.5);
    }

    playEmergencySiren() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.linearRampToValueAtTime(550, now + 0.25);
      osc.frequency.linearRampToValueAtTime(880, now + 0.5);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.6);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.6);
    }

    playClick() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      this._playTone(900, now, 0.04, 'sine', 0.05);
    }

    _playTone(freq, time, duration, type = 'sine', volume = 0.1) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, time);
      gain.gain.setValueAtTime(volume, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(time);
      osc.stop(time + duration);
    }
  }

  // --------------------------------------------------------------------------
  // 7. MAIN SMART ELEVATOR APP CLASS
  // --------------------------------------------------------------------------
  class SmartElevatorApp {
    constructor() {
      // Single Source of Truth: Current Composite DFA State
      this.currentState = new DfaState(1, 'CLOSED', 'IDLE', 0, 'NORMAL');
      this.lastInputSymbol = '—';
      this.stepCounter = 0;
      this.history = [];

      // Concurrency & Discrete Physics Engine
      this.isAnimating = false;
      this.autoTickTimer = null;
      this.autoTickEnabled = true;
      this.stepDurationMs = 1000;
      this.activeServingMask = 0;
      this.doorDwellCounter = 0; // Ticks doors stay open for passenger boarding

      // Subsystems
      this.sound = new SoundSynthesizer();
      this.isPresentationMode = false;
      this.activeArrowFilter = 'all';

      // SVG Node Map for Visualizer
      this.nodeCoords = {
        q4C: { x: 140, y: 70,  label: 'q4C', sub: 'Floor 4 Closed' },
        q3C: { x: 140, y: 175, label: 'q3C', sub: 'Floor 3 Closed' },
        q2C: { x: 140, y: 280, label: 'q2C', sub: 'Floor 2 Closed' },
        q1C: { x: 140, y: 385, label: 'q1C', sub: 'Floor 1 Closed' },

        q4O: { x: 410, y: 70,  label: 'q4O', sub: 'Floor 4 Open' },
        q3O: { x: 410, y: 175, label: 'q3O', sub: 'Floor 3 Open' },
        q2O: { x: 410, y: 280, label: 'q2O', sub: 'Floor 2 Open' },
        q1O: { x: 410, y: 385, label: 'q1O', sub: 'Floor 1 Open' },

        qE:  { x: 650, y: 225, label: 'qE', sub: 'Emergency Mode' }
      };

      this.dom = {};
    }

    init() {
      this.cacheElements();
      this.renderSvgDfaGraph();
      this.renderTransitionMatrixTable();
      this.renderRadarCards(this.currentState);
      this.bindEvents();
      this.updateAllViews();
      this.startAutoTickLoop();
      console.log('Smart Elevator DFA Simulator initialized at q0 = (Floor 1, CLOSED, IDLE, ∅, NORMAL)');
    }

    cacheElements() {
      // Header & Stats
      this.dom.soundToggleBtn = document.getElementById('soundToggleBtn');
      this.dom.soundIcon = document.getElementById('soundIcon');
      this.dom.soundLabel = document.getElementById('soundLabel');
      this.dom.presentationModeBtn = document.getElementById('presentationModeBtn');
      this.dom.resetSimulatorBtn = document.getElementById('resetSimulatorBtn');
      this.dom.stripTotalStates = document.getElementById('stripTotalStates');
      this.dom.stripCurrentState = document.getElementById('stripCurrentState');
      this.dom.stripCurrentFloor = document.getElementById('stripCurrentFloor');
      this.dom.stripDoorStatus = document.getElementById('stripDoorStatus');
      this.dom.stripDirection = document.getElementById('stripDirection');
      this.dom.stripSimulationMode = document.getElementById('stripSimulationMode');

      // Presentation Mode Cockpit
      this.dom.presTopState = document.getElementById('presTopState');
      this.dom.presTopInput = document.getElementById('presTopInput');
      this.dom.presTopNext = document.getElementById('presTopNext');
      this.dom.presTopFormula = document.getElementById('presTopFormula');
      this.dom.presBottomExplanation = document.getElementById('presBottomExplanation');
      this.dom.exitPresentationBtn = document.getElementById('exitPresentationBtn');

      // Banners
      this.dom.emergencyAlertBanner = document.getElementById('emergencyAlertBanner');
      this.dom.emergencyBannerDesc = document.getElementById('emergencyBannerDesc');

      // Elevator Physical Model
      this.dom.cabinStatusPill = document.getElementById('cabinStatusPill');
      this.dom.cabinStatusText = document.getElementById('cabinStatusText');
      this.dom.motorGear = document.getElementById('motorGear');
      this.dom.elevatorCabin = document.getElementById('elevatorCabin');
      this.dom.cabinDirArrow = document.getElementById('cabinDirArrow');
      this.dom.cabinFloorDigit = document.getElementById('cabinFloorDigit');
      this.dom.cabinStateTag = document.getElementById('cabinStateTag');
      this.dom.cabinInterior = document.getElementById('cabinInterior');
      this.dom.doorLeft = document.getElementById('doorLeft');
      this.dom.doorRight = document.getElementById('doorRight');

      // Hall & Cabin Buttons
      this.dom.copBtns = {
        1: document.getElementById('copBtn1'),
        2: document.getElementById('copBtn2'),
        3: document.getElementById('copBtn3'),
        4: document.getElementById('copBtn4')
      };
      this.dom.destBtns = {
        1: document.getElementById('destBtn1'),
        2: document.getElementById('destBtn2'),
        3: document.getElementById('destBtn3'),
        4: document.getElementById('destBtn4')
      };
      this.dom.hallBtns = {
        '1_UP': document.getElementById('hallBtn1Up'),
        '2_UP': document.getElementById('hallBtn2Up'),
        '2_DOWN': document.getElementById('hallBtn2Down'),
        '3_UP': document.getElementById('hallBtn3Up'),
        '3_DOWN': document.getElementById('hallBtn3Down'),
        '4_DOWN': document.getElementById('hallBtn4Down')
      };

      // Queue & Route Planner
      this.dom.activeRequestsChips = document.getElementById('activeRequestsChips');
      this.dom.routeCurrentFloor = document.getElementById('routeCurrentFloor');
      this.dom.routeDirection = document.getElementById('routeDirection');
      this.dom.routeNextStop = document.getElementById('routeNextStop');
      this.dom.routePlannedPath = document.getElementById('routePlannedPath');
      this.dom.simPlayPauseIcon = document.getElementById('simPlayPauseIcon');
      this.dom.simPlayPauseText = document.getElementById('simPlayPauseText');
      this.dom.simSpeedSelect = document.getElementById('simSpeedSelect');

      // DFA Visualizer
      this.dom.svgTransitionsGroup = document.getElementById('svgTransitionsGroup');
      this.dom.svgLabelsGroup = document.getElementById('svgLabelsGroup');
      this.dom.svgParticleGroup = document.getElementById('svgParticleGroup');
      this.dom.svgNodesGroup = document.getElementById('svgNodesGroup');
      this.dom.dfaFloatingTooltip = document.getElementById('dfaFloatingTooltip');
      this.dom.tooltipHeader = document.getElementById('tooltipHeader');
      this.dom.tooltipBody = document.getElementById('tooltipBody');
      this.dom.tooltipFormula = document.getElementById('tooltipFormula');
      this.dom.radarActiveState = document.getElementById('radarActiveState');
      this.dom.radarCardsGrid = document.getElementById('radarCardsGrid');

      this.dom.hudPrevState = document.getElementById('hudPrevState');
      this.dom.hudInputSymbol = document.getElementById('hudInputSymbol');
      this.dom.hudNextState = document.getElementById('hudNextState');
      this.dom.hudDeltaFormula = document.getElementById('hudDeltaFormula');

      // Analysis & Explanations
      this.dom.cardCurrentState = document.getElementById('cardCurrentState');
      this.dom.cardCurrentFloor = document.getElementById('cardCurrentFloor');
      this.dom.cardDoorStatus = document.getElementById('cardDoorStatus');
      this.dom.cardDirection = document.getElementById('cardDirection');
      this.dom.cardPendingReqs = document.getElementById('cardPendingReqs');
      this.dom.cardAutomatonStatus = document.getElementById('cardAutomatonStatus');
      this.dom.explanationText = document.getElementById('explanationText');
      this.dom.explanationMath = document.getElementById('explanationMath');

      // Sequence Tester
      this.dom.seqInputBox = document.getElementById('seqInputBox');
      this.dom.seqTraceBox = document.getElementById('seqTraceBox');
      this.dom.traceResultBadge = document.getElementById('traceResultBadge');
      this.dom.traceSummary = document.getElementById('traceSummary');
      this.dom.traceStepsContainer = document.getElementById('traceStepsContainer');

      // Log & Table
      this.dom.executionLogList = document.getElementById('executionLogList');
      this.dom.matrixTableBody = document.querySelector('#matrixTable tbody');
      this.dom.transitionTableContainer = document.getElementById('transitionTableContainer');
      this.dom.tableToggleHint = document.getElementById('tableToggleHint');
      this.dom.tableChevronIcon = document.getElementById('tableChevronIcon');

      this.dom.toastContainer = document.getElementById('toastContainer');
    }

    // ------------------------------------------------------------------------
    // 8. EVENT INGESTION & DISCRETE TRANSITION DISPATCHER
    // ------------------------------------------------------------------------
    sendInput(inputSymbol) {
      this.sound.playClick();
      const prevState = this.currentState.clone();

      // 1. If user picks a cabin request while doors are open, immediately ready to move
      if (inputSymbol.startsWith('REQ_CABIN_')) {
        this.doorDwellCounter = 0;
      } else if (inputSymbol === 'C') {
        this.doorDwellCounter = 0;
      }

      // 2. Evaluate Total Transition Function δ(currentState, inputSymbol)
      const res = delta(this.currentState, inputSymbol);
      this.currentState = res.nextState;
      this.lastInputSymbol = inputSymbol;
      this.stepCounter++;

      // 3. Add to timestamped execution log
      this.addLogEntry(this.stepCounter, prevState.getCompactDisplay(), inputSymbol, this.currentState.getCompactDisplay(), res.explanation);

      // 4. If request addition, show feedback and wake up dispatcher if idle
      if (res.action === 'REQUEST_ADDED') {
        this.showToast(`Request registered: ${inputSymbol.replace('REQ_', '').replace('_', ' ')}`);
        this.updateAllViews(prevState, inputSymbol, this.currentState, res.explanation);
        
        // If idle, immediately evaluate step
        if (!this.isAnimating && this.autoTickEnabled) {
          this.stepTick();
        }
        return;
      }

      // 5. If doors just opened (serving request or manual O), give a generous 4-second dwell time for boarding
      if (res.action === 'SERVE_REQUEST' || res.action === 'DOOR_OPEN') {
        this.doorDwellCounter = 4;
      }

      // 6. If emergency or reset
      if (res.action === 'EMERGENCY_TRIGGERED') {
        this.sound.playEmergencySiren();
        this.showToast('EMERGENCY ACTIVATED (Safety Clamps Engaged)', 'error');
      } else if (res.action === 'EMERGENCY_RESET') {
        this.sound.playChime();
        this.showToast('Emergency Reset Successful. Resuming normal operation.', 'success');
      }

      // 7. Trigger synchronized physical animation and view update
      this.animateStep(prevState, inputSymbol, this.currentState, res);
    }

    // Discrete Clock Tick Event T
    stepTick() {
      if (this.isAnimating) return;
      this.sendInput('T');
    }

    startAutoTickLoop() {
      if (this.autoTickTimer) clearInterval(this.autoTickTimer);
      this.autoTickTimer = setInterval(() => {
        if (this.isAnimating || !this.autoTickEnabled || this.currentState.mode !== 'NORMAL') {
          return;
        }

        // When door is OPEN: hold doors open for passenger boarding dwell time
        if (this.currentState.door === 'OPEN') {
          if (this.doorDwellCounter > 0) {
            this.doorDwellCounter--;
            this.updateCabinStatusMsg();
            return;
          }
          // Dwell finished: Trigger Tick T to close doors
          this.sendInput('T');
          return;
        }

        // When door is CLOSED and requests exist: advance SCAN
        if (this.currentState.hasAnyRequests()) {
          this.sendInput('T');
        }
      }, this.stepDurationMs);
    }

    toggleAutoTick() {
      this.autoTickEnabled = !this.autoTickEnabled;
      if (this.dom.simPlayPauseIcon) {
        this.dom.simPlayPauseIcon.className = this.autoTickEnabled ? 'fa-solid fa-pause' : 'fa-solid fa-play';
      }
      if (this.dom.simPlayPauseText) {
        this.dom.simPlayPauseText.textContent = `Auto-Tick: ${this.autoTickEnabled ? 'ON' : 'OFF'}`;
      }
      this.showToast(`Auto-Tick ${this.autoTickEnabled ? 'Enabled' : 'Paused'}`);
    }

    clearAllRequests() {
      if (this.currentState.mode === 'EMERGENCY') {
        this.showToast('Cannot clear requests while in Emergency Mode. Reset first.', 'error');
        return;
      }
      this.currentState = new DfaState(this.currentState.floor, this.currentState.door, 'IDLE', 0, 'NORMAL');
      this.doorDwellCounter = 0;
      this.updateAllViews();
      this.showToast('All pending requests cleared');
    }

    // ------------------------------------------------------------------------
    // 9. ANIMATION SYNCHRONIZATION (PHYSICAL MODEL & SVG GRAPH)
    // ------------------------------------------------------------------------
    animateStep(prevState, inputSymbol, nextState, transitionResult) {
      this.isAnimating = true;
      this.activeServingMask = transitionResult.servedMask || 0;

      // 1. Update DFA SVG Graph and Photon Particle
      this.animateSvgGraph(prevState, inputSymbol, nextState);

      // 2. Physical Floor Travel Animation
      const floorChanged = nextState.floor !== prevState.floor;
      if (floorChanged) {
        const floorBottomPx = (nextState.floor - 1) * 120 + 8;
        this.dom.elevatorCabin.style.bottom = `${floorBottomPx}px`;

        if (nextState.floor > prevState.floor) {
          this.dom.motorGear.classList.add('motor-active');
        } else {
          this.dom.motorGear.classList.add('motor-active');
        }

        this.sound.playMotorHum();
      }

      // 3. Sliding Doors Animation
      if (nextState.door === 'OPEN') {
        this.dom.cabinInterior.classList.add('doors-open');
        this.sound.playDoorSlide();
        if (this.activeServingMask !== 0) {
          setTimeout(() => this.sound.playChime(), 200);
        }
      } else {
        this.dom.cabinInterior.classList.remove('doors-open');
        if (prevState.door === 'OPEN') {
          this.sound.playDoorSlide();
        }
      }

      // 4. Update all UI Panels and Buttons
      this.updateAllViews(prevState, inputSymbol, nextState, transitionResult.explanation);

      // 5. Complete animation lock after travel/door duration
      const animDuration = floorChanged ? this.stepDurationMs * 0.85 : 400;
      setTimeout(() => {
        this.isAnimating = false;
        this.dom.motorGear.classList.remove('motor-active');
        this.activeServingMask = 0;
        this.updateButtonHighlights();
      }, animDuration);
    }

    animateSvgGraph(prevState, inputSymbol, nextState) {
      const baseNodeId = nextState.mode === 'EMERGENCY' ? 'qE' : `q${nextState.floor}${nextState.door === 'OPEN' ? 'O' : 'C'}`;
      
      document.querySelectorAll('.dfa-node-group').forEach(node => {
        node.classList.remove('node-active');
      });

      const activeNode = document.getElementById(`node_${baseNodeId}`);
      if (activeNode) activeNode.classList.add('node-active');

      const prevBase = prevState.mode === 'EMERGENCY' ? 'qE' : `q${prevState.floor}${prevState.door === 'OPEN' ? 'O' : 'C'}`;
      document.querySelectorAll('.dfa-path').forEach(p => {
        p.classList.remove('path-active', 'path-emergency-active');
      });

      const matchPath = document.querySelector(`.dfa-path[data-from="${prevBase}"][data-to="${baseNodeId}"]`);
      if (matchPath) {
        if (nextState.mode === 'EMERGENCY') {
          matchPath.classList.add('path-emergency-active');
        } else {
          matchPath.classList.add('path-active');
        }
        this.spawnPhotonParticle(matchPath, nextState.mode === 'EMERGENCY');
      }
    }

    spawnPhotonParticle(pathEl, isEmergency = false) {
      if (!this.dom.svgParticleGroup || !pathEl.getTotalLength) return;
      this.dom.svgParticleGroup.innerHTML = '';

      const totalLen = pathEl.getTotalLength();
      if (totalLen <= 0) return;

      const particle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      particle.setAttribute('r', '6');
      particle.setAttribute('fill', isEmergency ? '#ef4444' : '#38bdf8');
      particle.setAttribute('filter', isEmergency ? 'url(#glow-red)' : 'url(#glow-cyan)');
      this.dom.svgParticleGroup.appendChild(particle);

      const startTime = performance.now();
      const duration = 400;

      const step = (now) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const point = pathEl.getPointAtLength(progress * totalLen);

        particle.setAttribute('cx', point.x);
        particle.setAttribute('cy', point.y);

        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          setTimeout(() => {
            if (particle.parentNode) particle.parentNode.removeChild(particle);
          }, 100);
        }
      };

      requestAnimationFrame(step);
    }

    // ------------------------------------------------------------------------
    // 10. VIEW SYNCHRONIZATION & HUD UPDATES
    // ------------------------------------------------------------------------
    updateAllViews(prevState = this.currentState, symbol = this.lastInputSymbol, nextState = this.currentState, expl = null) {
      const isEmerg = nextState.mode === 'EMERGENCY';
      const formulaStr = `δ(${prevState.getCompactDisplay()}, ${symbol}) = ${nextState.getCompactDisplay()}`;
      const reasonStr = expl || `Elevator operating in mode ${nextState.mode} at Floor ${nextState.floor}.`;

      // 1. Header Strip
      this.dom.stripCurrentState.textContent = `q(F${nextState.floor}, ${nextState.door}, ${nextState.direction})`;
      this.dom.stripCurrentFloor.textContent = `Floor ${nextState.floor}`;
      this.dom.stripDoorStatus.textContent = nextState.door;
      
      let dirBadgeHtml = '<span class="dir-badge dir-idle"><i class="fa-solid fa-circle"></i> IDLE</span>';
      if (nextState.direction === 'UP') {
        dirBadgeHtml = '<span class="dir-badge dir-up"><i class="fa-solid fa-caret-up"></i> UP</span>';
      } else if (nextState.direction === 'DOWN') {
        dirBadgeHtml = '<span class="dir-badge dir-down"><i class="fa-solid fa-caret-down"></i> DOWN</span>';
      }
      this.dom.stripDirection.innerHTML = dirBadgeHtml;

      this.dom.stripSimulationMode.textContent = nextState.mode;
      this.dom.stripSimulationMode.className = `stat-value mode-badge ${isEmerg ? 'highlight-red' : ''}`;

      // 2. Cabin Overhead Indicator
      this.dom.cabinFloorDigit.textContent = nextState.floor;
      this.dom.cabinStateTag.textContent = nextState.getCompactDisplay();
      this.dom.cabinDirArrow.innerHTML = dirBadgeHtml;

      this.updateCabinStatusMsg();

      // 3. Emergency Banner Visibility
      if (isEmerg) {
        this.dom.emergencyAlertBanner.classList.remove('hidden');
        this.dom.emergencyBannerDesc.textContent = `Elevator stopped and locked at Floor ${nextState.floor}. All pending requests are preserved. Click Reset to recover.`;
        this.dom.elevatorCabin.style.boxShadow = '0 0 35px var(--emergency-glow)';
      } else {
        this.dom.emergencyAlertBanner.classList.add('hidden');
        this.dom.elevatorCabin.style.boxShadow = '';
      }

      // 4. External Wall Hall Landing Direction & Location Lanterns
      for (let f = 1; f <= 4; f++) {
        const lanternBox = document.getElementById(`landingInd${f}`);
        const lanternDir = document.getElementById(`lanternDir${f}`);
        const lanternStatus = document.getElementById(`lanternStatus${f}`);

        if (lanternBox && lanternDir && lanternStatus) {
          if (f === nextState.floor) {
            lanternBox.classList.add('active-landing');
            if (nextState.door === 'OPEN') {
              lanternDir.innerHTML = '<span class="lantern-here"><i class="fa-solid fa-door-open"></i> OPEN</span>';
              lanternStatus.textContent = `Boarding F${f}`;
            } else {
              lanternDir.innerHTML = '<span class="lantern-here"><i class="fa-solid fa-elevator"></i> HERE</span>';
              lanternStatus.textContent = `Floor ${f}`;
            }
          } else {
            lanternBox.classList.remove('active-landing');
            if (nextState.direction === 'UP') {
              lanternDir.innerHTML = '<span class="lantern-up"><i class="fa-solid fa-caret-up"></i> UP</span>';
              lanternStatus.textContent = `Car @ F${nextState.floor}`;
            } else if (nextState.direction === 'DOWN') {
              lanternDir.innerHTML = '<span class="lantern-down"><i class="fa-solid fa-caret-down"></i> DN</span>';
              lanternStatus.textContent = `Car @ F${nextState.floor}`;
            } else {
              lanternDir.innerHTML = '<span class="lantern-idle">• IDLE</span>';
              lanternStatus.textContent = `Car @ F${nextState.floor}`;
            }
          }
        }
      }

      // 5. Update Button Lights (WAITING / SERVING states)
      this.updateButtonHighlights();

      // 6. Active Requests Queue Chips & Route Planner
      this.updateQueueAndRouteViews();

      // 7. Analysis Panel
      this.dom.cardCurrentState.textContent = nextState.getDisplayTuple();
      this.dom.cardCurrentFloor.textContent = `Floor ${nextState.floor}`;
      this.dom.cardDoorStatus.textContent = nextState.door;
      this.dom.cardDirection.innerHTML = dirBadgeHtml;
      this.dom.cardPendingReqs.textContent = `0x${nextState.requests.toString(16).toUpperCase()} (${nextState.getRequestList().join(', ') || '∅'})`;
      this.dom.cardAutomatonStatus.textContent = isEmerg ? 'EMERGENCY HALT' : (nextState.hasAnyRequests() ? 'SERVING REQUESTS' : 'IDLE / READY');
      this.dom.explanationText.textContent = reasonStr;
      this.dom.explanationMath.textContent = formulaStr;

      // 8. Visualizer HUD
      this.dom.hudPrevState.textContent = prevState.getCompactDisplay();
      this.dom.hudInputSymbol.textContent = symbol;
      this.dom.hudNextState.textContent = nextState.getDisplayTuple();
      this.dom.hudDeltaFormula.textContent = formulaStr;

      // 9. Presentation Cockpit Sync
      if (this.dom.presTopState) this.dom.presTopState.textContent = prevState.getCompactDisplay();
      if (this.dom.presTopInput) this.dom.presTopInput.textContent = symbol;
      if (this.dom.presTopNext) this.dom.presTopNext.textContent = nextState.getCompactDisplay();
      if (this.dom.presTopFormula) this.dom.presTopFormula.textContent = formulaStr;
      if (this.dom.presBottomExplanation) this.dom.presBottomExplanation.textContent = reasonStr;

      // 10. Radar Cards update
      this.renderRadarCards(nextState);
    }

    updateCabinStatusMsg() {
      const nextState = this.currentState;
      let statusMsg = `IDLE AT FLOOR ${nextState.floor}`;
      if (nextState.mode === 'EMERGENCY') {
        statusMsg = 'EMERGENCY BRAKE LOCKED';
      } else if (nextState.door === 'OPEN') {
        if (this.doorDwellCounter > 0) {
          statusMsg = `DOORS OPEN — SELECT CABIN FLOOR 1..4 (${this.doorDwellCounter}s)`;
        } else {
          statusMsg = `DOORS CLOSING AT FLOOR ${nextState.floor}`;
        }
      } else if (nextState.direction === 'UP') {
        statusMsg = `ASCENDING TO NEXT STOP (▲ UP)`;
      } else if (nextState.direction === 'DOWN') {
        statusMsg = `DESCENDING TO NEXT STOP (▼ DOWN)`;
      }
      this.dom.cabinStatusText.textContent = statusMsg;
    }

    updateButtonHighlights() {
      const reqs = this.currentState.requests;
      const served = this.activeServingMask;

      // Cabin Buttons (COP & Destination Panel)
      for (let fl = 1; fl <= 4; fl++) {
        const mask = REQ_MASK[`CABIN_${fl}`];
        const isReq = (reqs & mask) !== 0;
        const isServ = (served & mask) !== 0;

        const copBtn = this.dom.copBtns[fl];
        if (copBtn) {
          copBtn.classList.toggle('active-waiting', isReq && !isServ);
          copBtn.classList.toggle('active-serving', isServ);
        }

        const destBtn = this.dom.destBtns[fl];
        if (destBtn) {
          destBtn.classList.toggle('active-waiting', isReq && !isServ);
          destBtn.classList.toggle('active-serving', isServ);
        }
      }

      // Hall Buttons
      const checkHall = (key, mask) => {
        const btn = this.dom.hallBtns[key];
        if (!btn) return;
        const isReq = (reqs & mask) !== 0;
        const isServ = (served & mask) !== 0;
        btn.classList.toggle('active-waiting', isReq && !isServ);
        btn.classList.toggle('active-serving', isServ);
      };

      checkHall('1_UP', REQ_MASK.HALL_1_UP);
      checkHall('2_UP', REQ_MASK.HALL_2_UP);
      checkHall('2_DOWN', REQ_MASK.HALL_2_DOWN);
      checkHall('3_UP', REQ_MASK.HALL_3_UP);
      checkHall('3_DOWN', REQ_MASK.HALL_3_DOWN);
      checkHall('4_DOWN', REQ_MASK.HALL_4_DOWN);
    }

    updateQueueAndRouteViews() {
      // 1. Render Active Requests Chips
      if (!this.dom.activeRequestsChips) return;
      this.dom.activeRequestsChips.innerHTML = '';

      const reqList = [];
      Object.keys(REQ_MASK).forEach(k => {
        const mask = REQ_MASK[k];
        if (this.currentState.requests & mask) {
          reqList.push({ key: k, mask: mask, info: REQ_LABELS[mask] });
        }
      });

      if (reqList.length === 0) {
        this.dom.activeRequestsChips.innerHTML = '<span class="no-requests-hint">No active pending requests (Elevator Idle)</span>';
      } else {
        reqList.forEach(r => {
          const chip = document.createElement('span');
          chip.classList.add('req-chip');
          if (r.info.type === 'cabin') chip.classList.add('chip-cabin');
          else if (r.info.type === 'hall_up') chip.classList.add('chip-hall-up');
          else if (r.info.type === 'hall_down') chip.classList.add('chip-hall-down');

          const isServ = (this.activeServingMask & r.mask) !== 0;
          if (isServ) chip.classList.add('chip-serving');

          chip.innerHTML = `${r.info.label} ${isServ ? '✓ SERVING' : '⏳ WAITING'}`;
          this.dom.activeRequestsChips.appendChild(chip);
        });
      }

      // 2. Compute Planned Route from actual DFA simulation
      const plan = planRouteFromState(this.currentState);
      this.dom.routeCurrentFloor.textContent = `Floor ${this.currentState.floor}`;
      
      let routeDirText = '• IDLE';
      if (this.currentState.direction === 'UP') routeDirText = '↑ UP (Ascending)';
      else if (this.currentState.direction === 'DOWN') routeDirText = '↓ DOWN (Descending)';
      this.dom.routeDirection.textContent = routeDirText;

      this.dom.routeNextStop.textContent = plan.nextStop;
      this.dom.routePlannedPath.textContent = plan.path;
    }

    // ------------------------------------------------------------------------
    // 11. SVG GRAPH VISUALIZER & OUTGOING RADAR
    // ------------------------------------------------------------------------
    renderSvgDfaGraph() {
      if (!this.dom.svgTransitionsGroup || !this.dom.svgNodesGroup) return;
      this.dom.svgTransitionsGroup.innerHTML = '';
      if (this.dom.svgLabelsGroup) this.dom.svgLabelsGroup.innerHTML = '';
      this.dom.svgNodesGroup.innerHTML = '';

      // 0. Formal Automata Initial State Entry Arrow (Start -> q1C)
      const startArrow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      startArrow.setAttribute('d', 'M 20 385 L 90 385');
      startArrow.setAttribute('stroke', '#10b981');
      startArrow.setAttribute('stroke-width', '2.5');
      startArrow.setAttribute('marker-end', 'url(#arrow-open)');
      this.dom.svgTransitionsGroup.appendChild(startArrow);

      const startLabelGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      startLabelGroup.classList.add('start-state-badge-group');
      const startRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      startRect.setAttribute('x', '20');
      startRect.setAttribute('y', '356');
      startRect.setAttribute('width', '68');
      startRect.setAttribute('height', '18');
      startRect.setAttribute('rx', '4');
      startRect.setAttribute('fill', '#064e3b');
      startRect.setAttribute('stroke', '#10b981');
      startRect.setAttribute('stroke-width', '1.5');
      startLabelGroup.appendChild(startRect);

      const startText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      startText.setAttribute('x', '54');
      startText.setAttribute('y', '366');
      startText.setAttribute('fill', '#34d399');
      startText.setAttribute('font-size', '9px');
      startText.setAttribute('font-weight', '800');
      startText.setAttribute('font-family', 'var(--font-mono)');
      startText.setAttribute('text-anchor', 'middle');
      startText.setAttribute('dominant-baseline', 'central');
      startText.textContent = 'START (q0)';
      startLabelGroup.appendChild(startText);
      this.dom.svgTransitionsGroup.appendChild(startLabelGroup);

      const paths = [
        // Up transitions
        { from: 'q1C', to: 'q2C', symbol: 'U', badge: '↑ U', type: 'U', d: 'M 125 365 C 105 325, 105 300, 125 295', lx: 100, ly: 330 },
        { from: 'q2C', to: 'q3C', symbol: 'U', badge: '↑ U', type: 'U', d: 'M 125 260 C 105 220, 105 195, 125 190', lx: 100, ly: 225 },
        { from: 'q3C', to: 'q4C', symbol: 'U', badge: '↑ U', type: 'U', d: 'M 125 155 C 105 115, 105 90, 125 85', lx: 100, ly: 120 },

        // Down transitions
        { from: 'q4C', to: 'q3C', symbol: 'D', badge: '↓ D', type: 'D', d: 'M 155 85 C 175 125, 175 150, 155 155', lx: 180, ly: 120 },
        { from: 'q3C', to: 'q2C', symbol: 'D', badge: '↓ D', type: 'D', d: 'M 155 190 C 175 230, 175 255, 155 260', lx: 180, ly: 225 },
        { from: 'q2C', to: 'q1C', symbol: 'D', badge: '↓ D', type: 'D', d: 'M 155 295 C 175 335, 175 360, 155 365', lx: 180, ly: 330 },

        // Open door transitions
        { from: 'q1C', to: 'q1O', symbol: 'O', badge: '↔ O', type: 'O', d: 'M 185 375 C 265 360, 310 360, 365 375', lx: 275, ly: 360 },
        { from: 'q2C', to: 'q2O', symbol: 'O', badge: '↔ O', type: 'O', d: 'M 185 270 C 265 255, 310 255, 365 270', lx: 275, ly: 255 },
        { from: 'q3C', to: 'q3O', symbol: 'O', badge: '↔ O', type: 'O', d: 'M 185 165 C 265 150, 310 150, 365 165', lx: 275, ly: 150 },
        { from: 'q4C', to: 'q4O', symbol: 'O', badge: '↔ O', type: 'O', d: 'M 185 60 C 265 45, 310 45, 365 60', lx: 275, ly: 45 },

        // Close door transitions
        { from: 'q1O', to: 'q1C', symbol: 'C', badge: '× C', type: 'C', d: 'M 365 395 C 310 410, 265 410, 185 395', lx: 275, ly: 410 },
        { from: 'q2O', to: 'q2C', symbol: 'C', badge: '× C', type: 'C', d: 'M 365 290 C 310 305, 265 305, 185 290', lx: 275, ly: 305 },
        { from: 'q3O', to: 'q3C', symbol: 'C', badge: '× C', type: 'C', d: 'M 365 185 C 310 200, 265 200, 185 185', lx: 275, ly: 200 },
        { from: 'q4O', to: 'q4C', symbol: 'C', badge: '× C', type: 'C', d: 'M 365 80 C 310 95, 265 95, 185 80', lx: 275, ly: 95 },

        // Emergency paths
        { from: 'q1C', to: 'qE', symbol: 'E', badge: '🚨 E', type: 'emergency', d: 'M 180 415 C 310 495, 490 480, 605 250', lx: 390, ly: 475 },
        { from: 'q2C', to: 'qE', symbol: 'E', badge: '🚨 E', type: 'emergency', d: 'M 180 310 C 310 375, 470 340, 605 235', lx: 380, ly: 350 },
        { from: 'q3C', to: 'qE', symbol: 'E', badge: '🚨 E', type: 'emergency', d: 'M 180 205 C 310 240, 470 230, 605 220', lx: 375, ly: 235 },
        { from: 'q4C', to: 'qE', symbol: 'E', badge: '🚨 E', type: 'emergency', d: 'M 180 100 C 340 120, 480 180, 605 210', lx: 365, ly: 140 }
      ];

      paths.forEach((p, idx) => {
        const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        pathEl.setAttribute('d', p.d);
        pathEl.setAttribute('id', `path_${p.from}_${p.symbol}_${p.to}_${idx}`);
        pathEl.setAttribute('data-from', p.from);
        pathEl.setAttribute('data-to', p.to);
        pathEl.setAttribute('data-symbol', p.symbol);
        pathEl.setAttribute('data-type', p.type);
        pathEl.classList.add('dfa-path', `path-${p.type}`);

        let marker = 'url(#arrow-default)';
        if (p.to === 'qE') marker = 'url(#arrow-emergency)';
        else if (p.type === 'U') marker = 'url(#arrow-up)';
        else if (p.type === 'D') marker = 'url(#arrow-down)';
        else if (p.type === 'O') marker = 'url(#arrow-open)';
        else if (p.type === 'C') marker = 'url(#arrow-close)';

        pathEl.setAttribute('marker-end', marker);
        this.dom.svgTransitionsGroup.appendChild(pathEl);

        if (this.dom.svgLabelsGroup && p.lx && p.ly) {
          const labelGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          labelGroup.classList.add('path-label-group');
          labelGroup.setAttribute('data-from', p.from);
          labelGroup.setAttribute('data-to', p.to);
          labelGroup.setAttribute('data-symbol', p.symbol);

          const badgeW = 34;
          const badgeH = 18;
          const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          rect.setAttribute('x', p.lx - badgeW / 2);
          rect.setAttribute('y', p.ly - badgeH / 2);
          rect.setAttribute('width', badgeW);
          rect.setAttribute('height', badgeH);
          rect.classList.add('path-badge-bg', `badge-bg-${p.type}`);
          labelGroup.appendChild(rect);

          const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          text.setAttribute('x', p.lx);
          text.setAttribute('y', p.ly);
          text.classList.add('path-badge-text');
          text.textContent = p.badge;
          labelGroup.appendChild(text);

          labelGroup.addEventListener('click', () => {
            this.sendInput(p.symbol);
          });

          this.dom.svgLabelsGroup.appendChild(labelGroup);
        }
      });

      // Draw Base Structural Nodes
      Object.keys(this.nodeCoords).forEach(nodeId => {
        const coord = this.nodeCoords[nodeId];
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.setAttribute('id', `node_${nodeId}`);
        group.setAttribute('data-state', nodeId);
        group.classList.add('dfa-node-group');

        const width = 88;
        const height = 48;
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', coord.x - width / 2);
        rect.setAttribute('y', coord.y - height / 2);
        rect.setAttribute('width', width);
        rect.setAttribute('height', height);
        rect.setAttribute('rx', '10');
        rect.classList.add('node-bg');
        group.appendChild(rect);

        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', coord.x);
        label.setAttribute('y', coord.y - 4);
        label.classList.add('node-label');
        label.textContent = coord.label;
        group.appendChild(label);

        const sublabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        sublabel.setAttribute('x', coord.x);
        sublabel.setAttribute('y', coord.y + 12);
        sublabel.classList.add('node-sublabel');
        sublabel.textContent = coord.sub;
        group.appendChild(sublabel);

        this.dom.svgNodesGroup.appendChild(group);
      });
    }

    renderRadarCards(state) {
      if (!this.dom.radarCardsGrid) return;
      this.dom.radarActiveState.textContent = state.getCompactDisplay();
      this.dom.radarCardsGrid.innerHTML = '';

      const testSymbols = ['U', 'D', 'O', 'C', 'T'];
      const symbolInfo = {
        U: { icon: '↑', name: 'Move Up' },
        D: { icon: '↓', name: 'Move Down' },
        O: { icon: '↔', name: 'Open Door' },
        C: { icon: '×', name: 'Close Door' },
        T: { icon: '⏱', name: 'System Tick' }
      };

      testSymbols.forEach(sym => {
        const res = delta(state, sym);
        const card = document.createElement('div');
        card.classList.add('radar-item-card');
        card.setAttribute('title', `Click to evaluate δ(q, ${sym})`);

        card.innerHTML = `
          <div class="radar-top-row">
            <span class="radar-symbol-badge sym-${sym}">${symbolInfo[sym].icon} ${sym}</span>
            <span class="radar-target-state highlight-cyan">${res.nextState.getCompactDisplay()}</span>
          </div>
          <span class="radar-desc">${symbolInfo[sym].name}: ${res.action}</span>
        `;

        card.addEventListener('click', () => {
          this.sendInput(sym);
        });

        this.dom.radarCardsGrid.appendChild(card);
      });
    }

    setArrowFilter(filterType) {
      this.activeArrowFilter = filterType;
      document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-filter') === filterType);
      });

      const paths = document.querySelectorAll('.dfa-path');
      const labels = document.querySelectorAll('.path-label-group');

      paths.forEach(p => p.classList.remove('path-dimmed'));
      labels.forEach(l => l.classList.remove('label-dimmed'));

      if (filterType === 'all') return;

      if (filterType === 'U' || filterType === 'D') {
        paths.forEach(p => { if (p.getAttribute('data-symbol') !== filterType) p.classList.add('path-dimmed'); });
        labels.forEach(l => { if (l.getAttribute('data-symbol') !== filterType) l.classList.add('label-dimmed'); });
      } else if (filterType === 'doors') {
        paths.forEach(p => {
          const s = p.getAttribute('data-symbol');
          if (s !== 'O' && s !== 'C') p.classList.add('path-dimmed');
        });
        labels.forEach(l => {
          const s = l.getAttribute('data-symbol');
          if (s !== 'O' && s !== 'C') l.classList.add('label-dimmed');
        });
      } else if (filterType === 'safety') {
        paths.forEach(p => { if (p.getAttribute('data-to') !== 'qE') p.classList.add('path-dimmed'); });
        labels.forEach(l => { if (l.getAttribute('data-to') !== 'qE') l.classList.add('label-dimmed'); });
      }

      this.showToast(`Transition filter: ${filterType.toUpperCase()}`);
    }

    // ------------------------------------------------------------------------
    // 12. STRUCTURAL TRANSITION TABLE RENDERING
    // ------------------------------------------------------------------------
    renderTransitionMatrixTable() {
      if (!this.dom.matrixTableBody) return;
      this.dom.matrixTableBody.innerHTML = '';

      const baseConfigs = [
        { name: 'q(F1, C, IDLE)', desc: 'Floor 1, Door Closed, Idle' },
        { name: 'q(F1, O, IDLE)', desc: 'Floor 1, Door Open, Idle' },
        { name: 'q(F2, C, UP)',   desc: 'Floor 2, Door Closed, Moving Up' },
        { name: 'q(F2, C, DOWN)', desc: 'Floor 2, Door Closed, Moving Down' },
        { name: 'q(F2, O, IDLE)', desc: 'Floor 2, Door Open, Idle' },
        { name: 'q(F3, C, UP)',   desc: 'Floor 3, Door Closed, Moving Up' },
        { name: 'q(F3, C, DOWN)', desc: 'Floor 3, Door Closed, Moving Down' },
        { name: 'q(F3, O, IDLE)', desc: 'Floor 3, Door Open, Idle' },
        { name: 'q(F4, C, IDLE)', desc: 'Floor 4, Door Closed, Idle' },
        { name: 'q(F4, O, IDLE)', desc: 'Floor 4, Door Open, Idle' },
        { name: 'q(EMERGENCY)',   desc: 'Emergency Locked State' }
      ];

      baseConfigs.forEach((cfg, idx) => {
        const row = document.createElement('tr');
        row.setAttribute('id', `tableRow_${idx}`);

        let rowHtml = `
          <td class="td-state-name">${cfg.name}</td>
          <td class="td-desc">${cfg.desc}</td>
          <td>${cfg.name.includes('F4') ? cfg.name + ' (Self-loop)' : 'Floor + 1'}</td>
          <td>${cfg.name.includes('F1') ? cfg.name + ' (Self-loop)' : 'Floor - 1'}</td>
          <td>${cfg.name.includes('O') ? cfg.name + ' (Self-loop)' : 'Door OPEN'}</td>
          <td>${cfg.name.includes('C') ? cfg.name + ' (Self-loop)' : 'Door CLOSED'}</td>
          <td>SCAN Step</td>
          <td class="cell-emergency">q(EMERGENCY)</td>
        `;

        row.innerHTML = rowHtml;
        this.dom.matrixTableBody.appendChild(row);
      });
    }

    // ------------------------------------------------------------------------
    // 13. PRESET EDUCATIONAL SCENARIOS (Viva & Classroom Demos)
    // ------------------------------------------------------------------------
    runScenario(scenarioType) {
      this.resetSimulator(false);

      setTimeout(() => {
        switch (scenarioType) {
          case 'normal-trip':
            this.sendInput('REQ_CABIN_3');
            this.showToast('Demo 1: Normal Single Trip (F1 → F3)');
            break;

          case 'multi-request':
            this.sendInput('REQ_CABIN_4');
            this.sendInput('REQ_HALL_2_DOWN');
            this.sendInput('REQ_HALL_3_UP');
            this.sendInput('REQ_HALL_1_UP');
            this.showToast('Demo 2: Multi-Request Simultaneous Ingestion (F4 + 2↓ + 3↑ + 1↑)');
            break;

          case 'request-during-transit':
            this.sendInput('REQ_CABIN_4');
            setTimeout(() => {
              this.sendInput('REQ_HALL_2_DOWN');
              this.showToast('Demo 3: Injected Floor 2 DOWN request mid-transit!');
            }, 1200);
            break;

          case 'boundary-top':
            this.currentState = new DfaState(4, 'CLOSED', 'IDLE', 0, 'NORMAL');
            this.updateAllViews();
            setTimeout(() => {
              this.sendInput('U');
              this.showToast('Demo 4: Boundary Top (Floor 4 + UP) evaluated as safe self-loop!');
            }, 300);
            break;

          case 'boundary-bottom':
            this.currentState = new DfaState(1, 'CLOSED', 'IDLE', 0, 'NORMAL');
            this.updateAllViews();
            setTimeout(() => {
              this.sendInput('D');
              this.showToast('Demo 5: Boundary Bottom (Floor 1 + DOWN) evaluated as safe self-loop!');
            }, 300);
            break;

          case 'door-safety':
            this.sendInput('O');
            setTimeout(() => {
              this.sendInput('U');
              this.showToast('Demo 6: Door Safety Interlock (Move while Door Open) rejected safely!');
            }, 600);
            break;

          case 'emergency-transit':
            this.sendInput('REQ_CABIN_4');
            this.sendInput('REQ_HALL_3_UP');
            setTimeout(() => {
              this.sendInput('E');
              this.showToast('Demo 7: Emergency triggered in transit! Elevator locked and requests preserved.');
            }, 1000);
            break;

          case 'emergency-recovery':
            this.currentState = new DfaState(3, 'CLOSED', 'IDLE', REQ_MASK.CABIN_4 | REQ_MASK.HALL_1_UP, 'EMERGENCY');
            this.updateAllViews();
            this.showToast('Demo 8: In Emergency at Floor 3 with pending requests. Pressing Reset...');
            setTimeout(() => {
              this.sendInput('R');
            }, 1200);
            break;

          default:
            console.warn(`Unknown scenario: ${scenarioType}`);
        }
      }, 250);
    }

    // ------------------------------------------------------------------------
    // 14. STRING SEQUENCE TESTER
    // ------------------------------------------------------------------------
    runSequenceFromInput() {
      const rawText = this.dom.seqInputBox.value.trim().toUpperCase();
      if (!rawText) {
        this.showToast('Please enter an input string to test');
        return;
      }

      const tokens = rawText.split(/[\s,]+/).filter(t => t.length > 0);
      let traceState = new DfaState(1, 'CLOSED', 'IDLE', 0, 'NORMAL');
      const traceSteps = [];
      let reachedEmerg = false;

      tokens.forEach((symbol, index) => {
        const res = delta(traceState, symbol);
        traceSteps.push({
          step: index + 1,
          from: traceState.getCompactDisplay(),
          symbol: symbol,
          to: res.nextState.getCompactDisplay(),
          action: res.action
        });
        traceState = res.nextState;
        if (res.nextState.mode === 'EMERGENCY') reachedEmerg = true;
      });

      this.dom.traceStepsContainer.innerHTML = '';
      traceSteps.forEach(s => {
        const row = document.createElement('div');
        row.classList.add('trace-step-row');
        if (s.to.includes('EMERGENCY')) row.classList.add('step-emergency');
        else row.classList.add('step-valid');

        row.innerHTML = `
          <span>Step ${s.step}:</span>
          <strong>${s.from}</strong>
          <span>--${s.symbol}--></span>
          <strong class="highlight-cyan">${s.to}</strong>
          <span class="col-desc">(${s.action})</span>
        `;
        this.dom.traceStepsContainer.appendChild(row);
      });

      if (reachedEmerg) {
        this.dom.traceResultBadge.className = 'trace-badge badge-emergency';
        this.dom.traceResultBadge.textContent = 'EMERGENCY MODE REACHED';
        this.dom.traceSummary.textContent = `Completed ${tokens.length} transitions. Final state is in EMERGENCY mode.`;
      } else {
        this.dom.traceResultBadge.className = 'trace-badge badge-valid';
        this.dom.traceResultBadge.textContent = 'DETERMINISTIC TRACE VALID';
        this.dom.traceSummary.textContent = `Automaton completed all ${tokens.length} discrete steps safely. Final state: ${traceState.getCompactDisplay()}.`;
      }

      this.showToast(`Sequence trace evaluated (${tokens.length} transitions)`);
    }

    appendTokenToSeq(token) {
      const current = this.dom.seqInputBox.value.trim();
      this.dom.seqInputBox.value = current ? `${current} ${token}` : token;
    }

    clearSeqInput() {
      this.dom.seqInputBox.value = '';
      this.dom.traceStepsContainer.innerHTML = '<div class="trace-empty-hint">Evaluation trace will appear here...</div>';
      this.dom.traceResultBadge.className = 'trace-badge badge-neutral';
      this.dom.traceResultBadge.textContent = 'READY TO TEST';
      this.dom.traceSummary.textContent = 'Enter an input string and click RUN DFA.';
    }

    // ------------------------------------------------------------------------
    // 15. EXECUTION LOG & RESET
    // ------------------------------------------------------------------------
    addLogEntry(step, fromStr, inputStr, toStr, desc) {
      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0];

      const item = document.createElement('div');
      item.classList.add('log-item');
      if (toStr.includes('E)')) item.classList.add('log-emergency');

      const stepPadded = String(step).padStart(2, '0');
      item.innerHTML = `
        <span class="col-step">${stepPadded}</span>
        <span class="col-curr state-tag">${fromStr}</span>
        <span class="col-input symbol-tag">${inputStr}</span>
        <span class="col-next state-tag">${toStr}</span>
        <span class="col-desc">${desc}</span>
        <span class="col-time">${timeStr}</span>
      `;

      this.dom.executionLogList.insertBefore(item, this.dom.executionLogList.firstChild);
      this.history.push({ step, from: fromStr, input: inputStr, to: toStr, desc, time: timeStr });
    }

    clearHistory() {
      this.dom.executionLogList.innerHTML = `
        <div class="log-item initial-entry">
          <span class="col-step">00</span>
          <span class="col-curr state-tag">q0</span>
          <span class="col-input symbol-tag">—</span>
          <span class="col-next state-tag">q0</span>
          <span class="col-desc">Execution history cleared by user.</span>
          <span class="col-time">00:00:00</span>
        </div>
      `;
      this.history = [];
      this.showToast('Execution history cleared');
    }

    exportLog() {
      if (this.history.length === 0) {
        this.showToast('Log is empty');
        return;
      }
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.history, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `smart_elevator_dfa_log_${Date.now()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      this.showToast('DFA Execution Log exported');
    }

    resetSimulator(notify = true) {
      this.doorDwellCounter = 0;
      this.sendInput('R');
      if (notify) {
        this.showToast('DFA Simulator Reset to initial state q0', 'success');
      }
    }

    togglePresentationMode() {
      this.isPresentationMode = !this.isPresentationMode;
      document.body.classList.toggle('presentation-mode', this.isPresentationMode);

      if (this.isPresentationMode) {
        this.showToast('Entered Presentation Mode (Press Esc to Exit)', 'info');
        if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
      } else {
        this.showToast('Exited Presentation Mode', 'info');
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      }
      this.updateAllViews();
    }

    toggleTableCollapse() {
      const container = this.dom.transitionTableContainer;
      const icon = this.dom.tableChevronIcon;
      const hint = this.dom.tableToggleHint;

      if (container.classList.contains('hidden')) {
        container.classList.remove('hidden');
        icon.className = 'fa-solid fa-chevron-up';
        hint.textContent = 'Click to Collapse';
      } else {
        container.classList.add('hidden');
        icon.className = 'fa-solid fa-chevron-down';
        hint.textContent = 'Click to Expand';
      }
    }

    showToast(message, type = 'info') {
      if (!this.dom.toastContainer) return;
      const toast = document.createElement('div');
      toast.classList.add('toast');
      
      let icon = 'fa-circle-info';
      if (type === 'success') icon = 'fa-circle-check highlight-emerald';
      if (type === 'error') icon = 'fa-triangle-exclamation highlight-red';

      toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
      this.dom.toastContainer.appendChild(toast);

      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 3500);
    }

    // ------------------------------------------------------------------------
    // 16. EVENT BINDINGS & KEYBOARD SHORTCUTS
    // ------------------------------------------------------------------------
    bindEvents() {
      this.dom.soundToggleBtn.addEventListener('click', () => {
        this.sound.enabled = !this.sound.enabled;
        this.dom.soundLabel.textContent = `Sound: ${this.sound.enabled ? 'ON' : 'OFF'}`;
        this.dom.soundIcon.className = this.sound.enabled ? 'fa-solid fa-volume-high' : 'fa-solid fa-volume-xmark';
        this.showToast(`Sound effects ${this.sound.enabled ? 'Enabled' : 'Disabled'}`);
      });

      this.dom.presentationModeBtn.addEventListener('click', () => this.togglePresentationMode());
      this.dom.resetSimulatorBtn.addEventListener('click', () => this.resetSimulator());

      this.dom.simSpeedSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        if (val !== 'step') {
          this.stepDurationMs = parseInt(val, 10);
          this.startAutoTickLoop();
        }
      });

      window.addEventListener('keydown', (e) => {
        if (document.activeElement === this.dom.seqInputBox) return;

        const key = e.key.toUpperCase();

        if (e.key === 'Escape') {
          if (this.isPresentationMode) {
            e.preventDefault();
            this.togglePresentationMode();
            return;
          }
        }

        if (key === 'U' || e.key === 'ArrowUp') {
          e.preventDefault();
          this.sendInput('U');
        } else if (key === 'D' || e.key === 'ArrowDown') {
          e.preventDefault();
          this.sendInput('D');
        } else if (key === 'O') {
          e.preventDefault();
          this.sendInput('O');
        } else if (key === 'C') {
          e.preventDefault();
          this.sendInput('C');
        } else if (key === 'E') {
          e.preventDefault();
          this.sendInput('E');
        } else if (key === 'T') {
          e.preventDefault();
          this.stepTick();
        } else if (key === 'R') {
          e.preventDefault();
          this.sendInput('R');
        } else if (key === 'P') {
          e.preventDefault();
          this.togglePresentationMode();
        } else if (['1', '2', '3', '4'].includes(key)) {
          e.preventDefault();
          this.sendInput(`REQ_CABIN_${key}`);
        }
      });
    }
  }

  // Bulletproof initialization: checks readyState immediately
  function startApp() {
    if (!window.elevatorApp) {
      window.elevatorApp = new SmartElevatorApp();
      window.elevatorApp.init();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp);
  } else {
    startApp();
  }

})();

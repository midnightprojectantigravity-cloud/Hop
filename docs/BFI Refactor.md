## **Feature Request: Unified Metabolic Friction Engine (v3.3)**

### **1. Executive Summary**
Implement a **Trinity-weighted Logarithmic BFI (Body Friction Index)** system. This model defines the physical efficiency of a unit by calculating a weighted sum of stats and passing them through an aggressive logarithmic curve with a **Dampener**.

### **2. Core Variables & Constants**
The engine shall utilize these hardcoded constants for all BFI calculations:
* **Ceiling**: `14` (The metabolic floor for 0-stat units).
* **Scale Factor**: `1.87` (The multiplier governing total efficiency gain).
* **Dampener**: `7` (The sensitivity constant for early stat investment).

Stat Weights 
* **Body_Weight**: `3`
* **Instinct_Weight**: `6`
* **Mind_Weight**: `1`.

### **3. The BFI Formula**
The **Body Friction Index (BFI)** is a deterministic integer. The logarithmic component handles internal efficiency.

**Weighted_Sum** = B x **Body_Weight** + I x **Instinct_Weight** + M x **Mind_Weight**

**Base_BFI** = ROUND(**Ceiling** - (**Scale Factor** x ln(1 + **Weighted_Sum**/**Dampener**)))

---

### **4. Equipment Weight Tiers**
Weight is a flat integer penalty applied to the base BFI:
* **None**: `+0`
* **Light**: `+1`
* **Medium**: `+2`
* **Heavy**: `+3`

**Effective_BFI** = **Base_BFI** + **Weight_Tier**

---

### **5. Updated Deterministic Archetypes (**Base_BFI**)**
The **Dampener = 7** shift moves the mid-tier units into faster brackets earlier than the previous model.

| Archetype | Stats (B/I/M) | Weighted Sum | **Base_BFI** |
| :--- | :--- | :--- | :--- | :--- |
| **Sub-Human** | 0 / 0 / 0 | 0 | **14** |
| **Standard Human** | 10 / 10 / 10 | 100 | **9** |
| **Top Instinct** | 10 / 30 / 10 | 220 | **7** |
| **Elite Athlete** | 30 / 30 / 30 | 300 | **7** |
| **Apex Instinct** | 10 / 100 / 10 | 640 | **6** |
| **Superhuman** | 100 / 100 / 100 | 1000 | **5** |

---

### **6. Technical Acceptance Criteria**
* **Early Bloom Validation:** Confirm that a **Standard Human** (10/10/10) now sits at a base **BFI of 9**, allowing them to wear **Light Armor (+1)** and stay at the "Standard" BFI 10 baseline.
* **Specialist Parity:** Verify that **Top Instinct** and **Elite** units now occupy the **BFI 7** bracket, representing a significant 2-point lead over a standard human.
* **Headless Determinism:** Ensure `@hop/engine` produces these exact integers across all test suites to maintain combat balance integrity.
* **Weight Impact:** A **Standard Human** (9 BFI) in **Heavy Gear (+3)** must result in a final **BFI of 12**.

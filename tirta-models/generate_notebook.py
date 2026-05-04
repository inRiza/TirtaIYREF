"""
Run: python generate_notebook.py
Output: flood_risk_analysis.ipynb
FRI = Flood Risk Indicator

Pipeline:
- SegFormer-B0        → vegetation, impervious surface (Cityscapes pretrained)
- GroundingDINO-tiny  → detect drainage bounding boxes via text prompt
- SAM-vit-base        → precise masks from those boxes

FRI formula:
  FRI = (impervious × 0.5) − (vegetation × 0.3) − (drainage × 0.2)
"""

import nbformat
from nbformat.v4 import new_notebook, new_markdown_cell, new_code_cell


def cell(source):
    return new_code_cell(source)


def md(source):
    return new_markdown_cell(source)


def build_notebook():
    cells = [
        md(
            "# Flood Risk Segmentation Analysis\n\n"
            "Segmentasi foto streetview → hitung **FRI** (Flood Risk Indicator).\n\n"
            "Pipeline:\n"
            "- **SegFormer-B0** (Cityscapes) → vegetation & impervious surface\n"
            "- **Grounded SAM** (GroundingDINO + SAM) → drainage channel detection\n\n"
            "Komponen FRI:\n"
            "| Komponen | Pengaruh | Bobot |\n"
            "|---|---|---|\n"
            "| Impervious (jalan+bangunan) | Runoff → **naikkan** risiko | +0.50 |\n"
            "| Vegetasi | Absorpsi air → **turunkan** risiko | −0.30 |\n"
            "| Drainase | Kapasitas buang air → **turunkan** risiko | −0.20 |"
        ),

        md("## 0. Install Dependencies"),
        cell(
            "# Uncomment & run sekali\n"
            "# !pip install transformers torch torchvision Pillow numpy matplotlib"
        ),

        md("## 1. Imports & Setup"),
        cell("""\
import torch
import torch.nn.functional as F
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from PIL import Image
from transformers import (
    SegformerImageProcessor,
    SegformerForSemanticSegmentation,
    AutoProcessor,
    AutoModelForZeroShotObjectDetection,
    SamModel,
    SamProcessor,
)
import warnings
warnings.filterwarnings("ignore")

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
print(f"PyTorch : {torch.__version__}")
print(f"Device  : {DEVICE}")
"""),

        md("## 2. Load Models"),
        cell("""\
seg_processor = SegformerImageProcessor.from_pretrained(
    "nvidia/segformer-b0-finetuned-cityscapes-512-1024"
)
seg_model = SegformerForSemanticSegmentation.from_pretrained(
    "nvidia/segformer-b0-finetuned-cityscapes-512-1024"
).to(DEVICE)
seg_model.eval()
print("SegFormer-B0 loaded")

gdino_processor = AutoProcessor.from_pretrained("IDEA-Research/grounding-dino-tiny")
gdino_model = AutoModelForZeroShotObjectDetection.from_pretrained(
    "IDEA-Research/grounding-dino-tiny"
).to(DEVICE)
gdino_model.eval()
print("GroundingDINO-tiny loaded")

sam_processor = SamProcessor.from_pretrained("facebook/sam-vit-base")
sam_model = SamModel.from_pretrained("facebook/sam-vit-base").to(DEVICE)
sam_model.eval()
print("SAM-vit-base loaded")

CITYSCAPES_CLASSES = [
    "road", "sidewalk", "building", "wall", "fence", "pole",
    "traffic light", "traffic sign", "vegetation", "terrain", "sky",
    "person", "rider", "car", "truck", "bus", "train", "motorcycle", "bicycle",
]
FLOOD_CLASS_MAP = {
    "vegetation": [8, 9],
    "impervious": [0, 1, 2],
    "sky":        [10],
}
PALETTE = {
    0:  (128,  64, 128), 1:  (244,  35, 232), 2:  ( 70,  70,  70),
    3:  (102, 102, 156), 4:  (190, 153, 153), 5:  (153, 153, 153),
    6:  (250, 170,  30), 7:  (220, 220,   0), 8:  (107, 142,  35),
    9:  (152, 251, 152), 10: ( 70, 130, 180), 11: (220,  20,  60),
    12: (255,   0,   0), 13: (  0,   0, 142), 14: (  0,   0,  70),
    15: (  0,  60, 100), 16: (  0,  80, 100), 17: (  0,   0, 230),
    18: (119,  11,  32),
}
"""),

        md("## 3. Load Image"),
        cell("""\
IMAGE_PATH = "WhatsApp Image 2026-05-04 at 12.02.41 PM.jpeg"

image    = Image.open(IMAGE_PATH).convert("RGB")
image_np = np.array(image)
W, H     = image.size
print(f"Image size: {W} x {H}")

plt.figure(figsize=(10, 6))
plt.imshow(image)
plt.title("Input Image")
plt.axis("off")
plt.tight_layout()
plt.show()
"""),

        md("## 4. SegFormer — Vegetation & Impervious Surface"),
        cell("""\
def run_segformer(image, processor, model, device):
    inputs = processor(images=image, return_tensors="pt")
    inputs = {k: v.to(device) for k, v in inputs.items()}
    with torch.inference_mode():
        outputs = model(**inputs)
    upsampled = F.interpolate(
        outputs.logits,
        size=(image.size[1], image.size[0]),
        mode="bilinear",
        align_corners=False,
    )
    return upsampled.argmax(dim=1).squeeze().cpu().numpy()


seg_map = run_segformer(image, seg_processor, seg_model, DEVICE)
print(f"Classes found: {[CITYSCAPES_CLASSES[i] for i in np.unique(seg_map)]}")
"""),

        md("## 5. Visualize SegFormer"),
        cell("""\
def colorize(seg_map, palette):
    color_img = np.zeros((*seg_map.shape, 3), dtype=np.uint8)
    for class_id, color in palette.items():
        color_img[seg_map == class_id] = color
    return color_img


color_seg = colorize(seg_map, PALETTE)

fig, axes = plt.subplots(1, 2, figsize=(16, 6))
axes[0].imshow(image);     axes[0].set_title("Original");      axes[0].axis("off")
axes[1].imshow(color_seg); axes[1].set_title("SegFormer Map"); axes[1].axis("off")

legend = [
    mpatches.Patch(color=np.array(PALETTE[8])/255,  label="Vegetation"),
    mpatches.Patch(color=np.array(PALETTE[9])/255,  label="Terrain"),
    mpatches.Patch(color=np.array(PALETTE[0])/255,  label="Road"),
    mpatches.Patch(color=np.array(PALETTE[1])/255,  label="Sidewalk"),
    mpatches.Patch(color=np.array(PALETTE[2])/255,  label="Building"),
]
axes[1].legend(handles=legend, loc="lower right", fontsize=9)
plt.tight_layout()
plt.show()
"""),

        md(
            "## 6. Grounded SAM — Drainage Detection\n\n"
            "**Step 1:** GroundingDINO detect bounding boxes dari text prompt.\n"
            "**Step 2:** SAM generate precise mask dari tiap box.\n"
            "**Step 3:** Union semua masks → drainage mask final."
        ),
        cell("""\
DRAINAGE_TEXT      = "drainage channel . concrete gutter . roadside gutter . open drain . selokan"
DRAINAGE_THRESHOLD = 0.15


def detect_and_segment(image, text, gdino_proc, gdino_mod, sam_proc, sam_mod, device, threshold):
    inputs = gdino_proc(images=image, text=text, return_tensors="pt").to(device)
    with torch.inference_mode():
        outputs = gdino_mod(**inputs)

    results = gdino_proc.post_process_grounded_object_detection(
        outputs,
        inputs["input_ids"],
        target_sizes=[image.size[::-1]],
    )[0]

    keep   = results["scores"] >= threshold
    boxes  = results["boxes"][keep].cpu().numpy()
    scores = results["scores"][keep].cpu().numpy()
    labels = [l for l, m in zip(results["labels"], keep.tolist()) if m]

    if len(boxes) == 0:
        return np.zeros((image.size[1], image.size[0]), dtype=np.uint8), boxes, scores, labels

    sam_inputs = sam_proc(
        images=image, input_boxes=[boxes.tolist()], return_tensors="pt"
    ).to(device)
    with torch.inference_mode():
        sam_outputs = sam_mod(**sam_inputs)

    masks = sam_proc.post_process_masks(
        sam_outputs.pred_masks.cpu(),
        sam_inputs["original_sizes"].cpu(),
        sam_inputs["reshaped_input_sizes"].cpu(),
    )[0]

    union_mask = masks[:, 0, :, :].any(dim=0).numpy().astype(np.uint8)
    return union_mask, boxes, scores, labels


drainage_mask, drain_boxes, drain_scores, drain_labels = detect_and_segment(
    image, DRAINAGE_TEXT,
    gdino_processor, gdino_model,
    sam_processor, sam_model,
    DEVICE, DRAINAGE_THRESHOLD,
)

print(f"Drainage boxes    : {len(drain_boxes)}")
print(f"Drainage pixels   : {drainage_mask.sum():,}")
print(f"Drainage coverage : {drainage_mask.sum() / drainage_mask.size * 100:.2f}%")

fig, axes = plt.subplots(1, 2, figsize=(16, 6))
axes[0].imshow(image)
for box, score, label in zip(drain_boxes, drain_scores, drain_labels):
    x1, y1, x2, y2 = box
    axes[0].add_patch(plt.Rectangle((x1, y1), x2-x1, y2-y1,
                      linewidth=2, edgecolor="cyan", facecolor="none"))
    axes[0].text(x1, y1-5, f"{label} {score:.2f}", color="cyan", fontsize=7,
                 bbox=dict(facecolor="black", alpha=0.5, pad=1))
axes[0].set_title(f"GroundingDINO ({len(drain_boxes)} boxes)")
axes[0].axis("off")

overlay = image_np.copy()
overlay[drainage_mask.astype(bool)] = [0, 220, 220]
axes[1].imshow(overlay)
axes[1].set_title("SAM Drainage Mask (cyan)")
axes[1].axis("off")
plt.tight_layout()
plt.show()
"""),

        md(
            "### Tuning\n\n"
            "- Tidak ada box → turunkan `DRAINAGE_THRESHOLD` (coba `0.10`)\n"
            "- Terlalu banyak false positive → naikkan (coba `0.20`)\n"
            "- Tambah/ubah kata di `DRAINAGE_TEXT` jika perlu"
        ),
        cell("""\
DRAINAGE_THRESHOLD = 0.15  # ubah di sini

drainage_mask, drain_boxes, drain_scores, drain_labels = detect_and_segment(
    image, DRAINAGE_TEXT,
    gdino_processor, gdino_model,
    sam_processor, sam_model,
    DEVICE, DRAINAGE_THRESHOLD,
)

overlay = image_np.copy()
overlay[drainage_mask.astype(bool)] = [0, 220, 220]
plt.figure(figsize=(10, 6))
plt.imshow(overlay)
plt.title(f"Drainage — threshold={DRAINAGE_THRESHOLD}, boxes={len(drain_boxes)}, px={drainage_mask.sum():,}")
plt.axis("off")
plt.tight_layout()
plt.show()
"""),

        md("## 7. Area Calculation"),
        cell("""\
def calculate_areas(seg_map, drainage_mask, class_map):
    total     = seg_map.size
    veg_px    = sum(int((seg_map == c).sum()) for c in class_map["vegetation"])
    imperv_px = sum(int((seg_map == c).sum()) for c in class_map["impervious"])
    sky_px    = sum(int((seg_map == c).sum()) for c in class_map["sky"])
    drain_px  = int(drainage_mask.sum())
    effective = max(total - sky_px, 1)
    return {
        "vegetation_px":  veg_px,   "impervious_px":  imperv_px,
        "drainage_px":    drain_px,  "total_px":       total,
        "sky_px":         sky_px,    "effective_px":   effective,
        "vegetation_ratio":  veg_px    / effective,
        "impervious_ratio":  imperv_px / effective,
        "drainage_ratio":    drain_px  / effective,
    }


areas = calculate_areas(seg_map, drainage_mask, FLOOD_CLASS_MAP)

print(f"{'Vegetation':<15}: {areas['vegetation_ratio']*100:.1f}%  ({areas['vegetation_px']:,} px)")
print(f"{'Impervious':<15}: {areas['impervious_ratio']*100:.1f}%  ({areas['impervious_px']:,} px)")
print(f"{'Drainage':<15}: {areas['drainage_ratio']*100:.1f}%  ({areas['drainage_px']:,} px)")
print(f"{'Sky (excl.)':<15}: {areas['sky_px'] / areas['total_px']*100:.1f}%")
"""),

        md(
            "## 8. FRI Score\n\n"
            "```\n"
            "FRI = (impervious × 0.5) − (vegetation × 0.3) − (drainage × 0.2)\n"
            "```\n\n"
            "Normalisasi ke [0, 1]. Makin tinggi → makin berisiko banjir."
        ),
        cell("""\
def calculate_fri(areas):
    raw = (
        areas["impervious_ratio"] * 0.5
        - areas["vegetation_ratio"] * 0.3
        - areas["drainage_ratio"]  * 0.2
    )
    return float(max(0.0, min(1.0, raw / 0.5)))


def risk_label(fri):
    if fri < 0.3:  return "LOW — Area relatif aman"
    if fri < 0.6:  return "MEDIUM — Perlu perhatian"
    return "HIGH — Risiko banjir tinggi"


fri   = calculate_fri(areas)
label = risk_label(fri)

print("=" * 50)
print(f"  Impervious : {areas['impervious_ratio']*100:.1f}%  × 0.50 = +{areas['impervious_ratio']*0.50:.3f}")
print(f"  Vegetation : {areas['vegetation_ratio']*100:.1f}%  × 0.30 =  -{areas['vegetation_ratio']*0.30:.3f}")
print(f"  Drainage   : {areas['drainage_ratio']*100:.1f}%  × 0.20 =  -{areas['drainage_ratio']*0.20:.3f}")
print(f"{'─'*50}")
print(f"  FRI SCORE  : {fri:.3f}")
print(f"  RISK LEVEL : {label}")
print("=" * 50)
"""),

        md("## 9. Summary Dashboard"),
        cell("""\
fig = plt.figure(figsize=(18, 10))

ax1 = fig.add_subplot(2, 3, 1)
ax1.imshow(image); ax1.set_title("Original Image", fontsize=12); ax1.axis("off")

ax2 = fig.add_subplot(2, 3, 2)
ax2.imshow(color_seg); ax2.set_title("SegFormer Map", fontsize=12); ax2.axis("off")

ax3 = fig.add_subplot(2, 3, 3)
drain_overlay = image_np.copy()
drain_overlay[drainage_mask.astype(bool)] = [0, 220, 220]
ax3.imshow(drain_overlay)
ax3.set_title("Grounded SAM Drainage (cyan)", fontsize=12); ax3.axis("off")

ax4 = fig.add_subplot(2, 3, 4)
other = max(0.0, 1 - areas["vegetation_ratio"] - areas["impervious_ratio"] - areas["drainage_ratio"])
ax4.pie(
    [areas["vegetation_ratio"], areas["impervious_ratio"], areas["drainage_ratio"], other],
    labels=["Vegetation", "Impervious", "Drainage", "Other"],
    colors=["#6B8E23", "#808080", "#00CED1", "#D3D3D3"],
    autopct="%1.1f%%", startangle=90,
)
ax4.set_title("Area Distribution", fontsize=12)

ax5 = fig.add_subplot(2, 3, 5)
bar_color = "#2ECC71" if fri < 0.3 else "#F39C12" if fri < 0.6 else "#E74C3C"
ax5.barh(["FRI"], [fri],     color=bar_color, height=0.4)
ax5.barh(["FRI"], [1 - fri], left=[fri],      color="#ECF0F1", height=0.4)
ax5.set_xlim(0, 1)
ax5.axvline(0.3, color="orange", linestyle="--", alpha=0.7, label="Medium")
ax5.axvline(0.6, color="red",    linestyle="--", alpha=0.7, label="High")
ax5.legend(fontsize=8)
ax5.set_title(f"FRI Gauge: {fri:.3f}", fontsize=12)
ax5.text(max(fri/2, 0.05), 0, f"{fri:.2f}", ha="center", va="center",
         fontweight="bold", color="white", fontsize=11)

ax6 = fig.add_subplot(2, 3, 6)
ax6.axis("off")
summary = (
    f"FLOOD RISK SUMMARY\n"
    f"{'─'*30}\n"
    f"Impervious   : {areas['impervious_ratio']*100:.1f}%  (+0.50)\n"
    f"Vegetation   : {areas['vegetation_ratio']*100:.1f}%  (−0.30)\n"
    f"Drainage     : {areas['drainage_ratio']*100:.1f}%  (−0.20)\n"
    f"{'─'*30}\n"
    f"FRI Score    : {fri:.3f}\n"
    f"Risk Level   : {label}"
)
ax6.text(0.05, 0.5, summary, transform=ax6.transAxes, fontsize=11,
         va="center", fontfamily="monospace",
         bbox=dict(boxstyle="round", facecolor="lightblue", alpha=0.5))

plt.suptitle("Flood Risk Indicator (FRI) Analysis", fontsize=14, fontweight="bold")
plt.tight_layout()
plt.show()
"""),
    ]

    nb = new_notebook()
    nb.cells = cells
    return nb


if __name__ == "__main__":
    import os

    output_path = os.path.join(os.path.dirname(__file__), "flood_risk_analysis.ipynb")
    nb = build_notebook()

    with open(output_path, "w", encoding="utf-8") as f:
        nbformat.write(nb, f)

    print(f"Notebook generated : {output_path}")
    print("Next               : jupyter notebook flood_risk_analysis.ipynb")

"""
segmentation.py

Groups detected text regions into lines and orders them spatially.

Segmentation strategy chosen: LINE-LEVEL segmentation.

Rationale:
    Character-level segmentation requires reliable glyph isolation,
    which is highly sensitive to font, size, and scan quality. For
    an invoice MVP, line-level grouping is both viable and sufficient:
    it lets field_extraction apply regex patterns over the content of
    each line, which is the most productive approach at this stage.

    Word-level grouping (merging nearby regions) is also applied so
    that the recognition module receives manageable crops.

Algorithm:
    1. Sort regions top-to-bottom.
    2. Assign each region to a line based on vertical overlap with the
       current line's Y-band. The band is defined by the median height
       of all regions times a tolerance factor.
    3. Within each line, sort regions left-to-right.
"""

import logging
from dataclasses import dataclass, field

from app.services.ocr.text_region_detection import TextRegion

logger = logging.getLogger(__name__)


@dataclass
class TextLine:
    index: int
    regions: list[TextRegion] = field(default_factory=list)

    @property
    def y_center(self) -> int:
        if not self.regions:
            return 0
        return sum(r.center_y for r in self.regions) // len(self.regions)

    @property
    def y_top(self) -> int:
        return min(r.y for r in self.regions) if self.regions else 0

    @property
    def y_bottom(self) -> int:
        return max(r.y + r.h for r in self.regions) if self.regions else 0


def group_into_lines(
    regions: list[TextRegion],
    y_overlap_threshold: float = 0.4,
) -> list[TextLine]:
    """
    Group TextRegion objects into TextLine objects.

    Two regions belong to the same line when their vertical ranges overlap
    by at least y_overlap_threshold of the shorter region's height.

    Returns lines sorted top-to-bottom with regions sorted left-to-right.
    """
    if not regions:
        return []

    sorted_regions = sorted(regions, key=lambda r: (r.y, r.x))
    lines: list[TextLine] = []
    current_line = TextLine(index=0, regions=[sorted_regions[0]])

    for region in sorted_regions[1:]:
        if _overlaps_vertically(region, current_line, y_overlap_threshold):
            current_line.regions.append(region)
        else:
            current_line.regions.sort(key=lambda r: r.x)
            lines.append(current_line)
            current_line = TextLine(index=len(lines), regions=[region])

    current_line.regions.sort(key=lambda r: r.x)
    lines.append(current_line)

    logger.debug("Segmented %d regions into %d lines.", len(regions), len(lines))
    return lines


def _overlaps_vertically(
    region: TextRegion, line: TextLine, threshold: float
) -> bool:
    """
    Return True if the region's vertical span overlaps with the line's
    current vertical span by at least threshold * min_height pixels.
    """
    region_top = region.y
    region_bottom = region.y + region.h
    line_top = line.y_top
    line_bottom = line.y_bottom

    overlap_top = max(region_top, line_top)
    overlap_bottom = min(region_bottom, line_bottom)
    overlap = max(0, overlap_bottom - overlap_top)

    min_height = min(region.h, line.y_bottom - line.y_top)
    if min_height == 0:
        return False

    return (overlap / min_height) >= threshold

const PAGE_MARKER_RE = /<!--\s*tft-page:\s*(\d+)([^>]*)-->/gi;

function extractFrontmatter(markdown) {
  const match = String(markdown).match(/^---\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/);
  if (!match) {
    return {
      frontmatter: '',
      body: String(markdown),
    };
  }

  return {
    frontmatter: match[1],
    body: String(markdown).slice(match[0].length),
  };
}

function parseMarkerAttrs(rawAttrs) {
  const attrs = {};
  const attrText = String(rawAttrs || '').trim();
  if (!attrText) {
    return attrs;
  }

  for (const match of attrText.matchAll(/([a-zA-Z][\w-]*)=(?:"([^"]*)"|'([^']*)'|([^\s]+))/g)) {
    attrs[match[1]] = match[2] ?? match[3] ?? match[4] ?? '';
  }

  return attrs;
}

function trimPageBoundaryWhitespace(body) {
  return String(body)
    .replace(/^(?:[ \t]*\r?\n)+/, '')
    .replace(/(?:\r?\n[ \t]*)+$/, '');
}

function parsePagedMarkdown(markdown) {
  const { frontmatter, body } = extractFrontmatter(markdown);
  const markers = [...body.matchAll(PAGE_MARKER_RE)];

  if (markers.length === 0) {
    throw new Error('No page markers found. Add markers like <!-- tft-page: 1 -->.');
  }

  const prefix = body.slice(0, markers[0].index);
  if (prefix.trim()) {
    throw new Error('Content before the first page marker is not allowed, except YAML frontmatter.');
  }

  const pages = markers.map((marker, index) => {
    const number = Number(marker[1]);
    const expected = index + 1;
    if (number !== expected) {
      throw new Error(`Expected page marker ${expected} but found ${number}.`);
    }

    const bodyStart = marker.index + marker[0].length;
    const bodyEnd = index + 1 < markers.length ? markers[index + 1].index : body.length;

    return {
      number,
      attrs: parseMarkerAttrs(marker[2]),
      marker: marker[0],
      body: trimPageBoundaryWhitespace(body.slice(bodyStart, bodyEnd)),
    };
  });

  return {
    frontmatter,
    pages,
  };
}

function summarizePage(page) {
  const lines = String(page.body || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const heading = lines.find((line) => /^#{1,6}\s+/.test(line)) || lines[0] || '';
  const tail = lines.at(-1) || '';

  return {
    heading,
    tail,
  };
}

function validateMeasuredPages(pages, measurements, targetHeight = 1200) {
  const measurementByPage = new Map(
    measurements.map((measurement) => [measurement.page, measurement])
  );

  const reportPages = pages.map((page) => {
    const measurement = measurementByPage.get(page.number);
    if (!measurement) {
      throw new Error(`Missing measurement for page ${page.number}.`);
    }

    const height = Math.ceil(measurement.height);
    const overflow = Math.max(0, height - targetHeight);
    const remaining = Math.max(0, targetHeight - height);
    const summary = summarizePage(page);

    return {
      page: page.number,
      height,
      targetHeight,
      status: overflow > 0 ? 'overflow' : 'ok',
      overflow,
      remaining,
      heading: summary.heading,
      tail: summary.tail,
    };
  });

  return {
    ok: reportPages.every((page) => page.status === 'ok'),
    targetHeight,
    pages: reportPages,
  };
}

function formatCheckReport(report) {
  const lines = [
    `Paged markdown check: ${report.ok ? 'OK' : 'FAILED'}`,
    `Target height: ${report.targetHeight}px`,
    '',
  ];

  for (const page of report.pages) {
    if (page.status === 'ok') {
      lines.push(`第 ${page.page} 页 OK: ${page.height}px，剩余 ${page.remaining}px`);
      continue;
    }

    lines.push(`第 ${page.page} 页溢出: ${page.height}px / ${page.targetHeight}px，超出 ${page.overflow}px`);
    if (page.heading) {
      lines.push(`  开头: ${page.heading}`);
    }
    if (page.tail && page.tail !== page.heading) {
      lines.push(`  结尾: ${page.tail}`);
    }
  }

  return lines.join('\n').trimEnd();
}

export {
  formatCheckReport,
  parsePagedMarkdown,
  summarizePage,
  validateMeasuredPages,
};

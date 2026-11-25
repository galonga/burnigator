// JPG export of the map and of the selected day's timetable (print layouts).
// Classic script: create(ctx) is called by map.js once the event data has loaded.
(function () {
  window.BurnigatorMapExport = {
    create(ctx) {
      const {
        data,
        eventCategories,
        getSelectedDay,
        eventSpan,
        eventTimeLabel,
        contrastTextColor,
        eventBoxColor,
        timelineItems,
      } = ctx;
      async function addJpegResolution(blob, dpi) {
        const bytes = new Uint8Array(await blob.arrayBuffer());
        if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return blob;
        const jfif = [0x4a, 0x46, 0x49, 0x46, 0x00],
          density = Math.max(1, Math.min(65535, Math.round(dpi)));
        let offset = 2;
        while (offset + 4 <= bytes.length) {
          if (bytes[offset] !== 0xff) break;
          while (bytes[offset] === 0xff) offset++;
          const marker = bytes[offset++];
          if (marker === 0xda || marker === 0xd9) break;
          if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
          const length = (bytes[offset] << 8) | bytes[offset + 1];
          if (length < 2 || offset + length > bytes.length) break;
          const payload = offset + 2;
          if (marker === 0xe0 && jfif.every((value, index) => bytes[payload + index] === value)) {
            const units = payload + 7,
              x = payload + 8,
              y = payload + 10;
            bytes[units] = 1;
            bytes[x] = density >> 8;
            bytes[x + 1] = density & 255;
            bytes[y] = density >> 8;
            bytes[y + 1] = density & 255;
            return new Blob([bytes], { type: 'image/jpeg' });
          }
          offset += length;
        }
        const segment = new Uint8Array([
            0xff,
            0xe0,
            0x00,
            0x10,
            0x4a,
            0x46,
            0x49,
            0x46,
            0x00,
            0x01,
            0x02,
            0x01,
            density >> 8,
            density & 255,
            density >> 8,
            density & 255,
            0x00,
            0x00,
          ]),
          output = new Uint8Array(bytes.length + segment.length);
        output.set(bytes.subarray(0, 2));
        output.set(segment, 2);
        output.set(bytes.subarray(2), 2 + segment.length);
        return new Blob([output], { type: 'image/jpeg' });
      }
      function downloadJpg(canvas, filename, options = {}) {
        canvas.toBlob(
          async (blob) => {
            if (!blob) {
              alert(window.AppI18n.t('jpgExportFailed'));
              return;
            }
            try {
              if (options.dpi) blob = await addJpegResolution(blob, options.dpi);
              const url = URL.createObjectURL(blob),
                link = document.createElement('a');
              link.href = url;
              link.download = filename;
              document.body.appendChild(link);
              link.click();
              link.remove();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            } catch (_) {
              alert(window.AppI18n.t('jpgExportFailed'));
            }
          },
          'image/jpeg',
          options.quality ?? 0.92
        );
      }
      function exportMapJpg() {
        if (!data.image) {
          alert(window.AppI18n.t('mapPdfNoImage'));
          return;
        }
        const source = new Image();
        source.onload = async () => {
          const categories = data.categories || [],
            pois = data.pois || [];
          let num = 0;
          const items = [];
          categories.forEach((category) =>
            pois
              .filter((p) => p.categoryId === category.id)
              .forEach((p) => items.push({ number: ++num, p, category }))
          );
          pois
            .filter((p) => !categories.some((c) => c.id === p.categoryId))
            .forEach((p) => items.push({ number: ++num, p, category: null }));
          const groups = categories
              .map((category) => ({
                category,
                rows: items.filter((item) => item.category?.id === category.id),
              }))
              .filter((group) => group.rows.length),
            uncategorized = items.filter((item) => !item.category);
          if (uncategorized.length)
            groups.push({ category: { name: window.AppI18n.t('uncategorized') }, rows: uncategorized });
          const width = 3000,
            mapHeight = 1450,
            indexStart = 1650,
            indexColumnW = 900,
            indexColumnTextW = indexColumnW - 60,
            estimateLines = (text, maxChars) => Math.max(1, Math.ceil(String(text).length / maxChars)),
            columnHeights = [0, 0, 0],
            groupColumns = [];
          groups.forEach((group) => {
            const lines = estimateLines(group.category.name, 58),
              height =
                lines * 36 +
                8 +
                group.rows.reduce(
                  (sum, item) =>
                    sum +
                    estimateLines(
                      (item.p.name || window.AppI18n.t('locationName')) + '. ' + item.number,
                      68
                    ) *
                      38,
                  0
                ) +
                24,
              col = columnHeights.indexOf(Math.min(...columnHeights));
            groupColumns.push(col);
            columnHeights[col] += height;
          });
          const qrEnabled = typeof data.qrUrl === 'string' && /^https?:\/\//i.test(data.qrUrl),
            height = Math.max(1900, indexStart + Math.max(...columnHeights) + (qrEnabled ? 190 : 70)),
            targetScale = 7016 / width,
            maxPixels = 40000000,
            maxDimension = 32767,
            scale = Math.min(
              targetScale,
              Math.sqrt(maxPixels / (width * height)),
              maxDimension / Math.max(width, height)
            ),
            printDpi = Math.max(1, Math.round((300 * scale) / targetScale)),
            canvas = document.createElement('canvas');
          canvas.width = Math.round(width * scale);
          canvas.height = Math.round(height * scale);
          const ctx = canvas.getContext('2d');
          ctx.scale(scale, scale);
          ctx.fillStyle = '#fffaf3';
          ctx.fillRect(0, 0, width, height);
          ctx.fillStyle = '#305eaa';
          ctx.font = 'bold 58px system-ui, sans-serif';
          ctx.fillText(data.title || window.AppI18n.t('map'), 70, 85);
          const area = { x: 70, y: 135, w: 2860, h: mapHeight };
          const imageScale = Math.min(area.w / source.naturalWidth, area.h / source.naturalHeight),
            iw = source.naturalWidth * imageScale,
            ih = source.naturalHeight * imageScale,
            ix = area.x + (area.w - iw) / 2,
            iy = area.y + (area.h - ih) / 2;
          ctx.fillStyle = '#e6d0bb';
          ctx.fillRect(ix, iy, iw, ih);
          ctx.drawImage(source, ix, iy, iw, ih);
          items.forEach(({ number, p }) => {
            const cx = ix + Math.max(0, Math.min(1, Number(p.x) || 0)) * iw,
              cy = iy + Math.max(0, Math.min(1, Number(p.y) || 0)) * ih,
              r = 22;
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fillStyle = '#305eaa';
            ctx.fill();
            ctx.lineWidth = 4;
            ctx.strokeStyle = '#fff';
            ctx.stroke();
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 23px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(number), cx, cy);
          });
          ctx.textAlign = 'left';
          ctx.textBaseline = 'alphabetic';
          ctx.fillStyle = '#305eaa';
          ctx.font = 'bold 46px system-ui, sans-serif';
          ctx.fillText(window.AppI18n.t('poiIndex'), 70, indexStart - 25);
          const drawWrapped = (text, x, y, maxWidth, lineHeight, font, color) => {
            ctx.font = font;
            ctx.fillStyle = color;
            const words = String(text).split(/\s+/);
            let line = '';
            const lines = [];
            for (const word of words) {
              const trial = line ? line + ' ' + word : word;
              if (ctx.measureText(trial).width > maxWidth && line) {
                lines.push(line);
                line = word;
              } else line = trial;
            }
            if (line) lines.push(line);
            lines.forEach((part, index) => ctx.fillText(part, x, y + index * lineHeight));
            return y + lines.length * lineHeight;
          };
          const columns = [indexStart, indexStart, indexStart];
          groups.forEach((group, index) => {
            const col = groupColumns[index],
              x = 70 + col * indexColumnW;
            let y = columns[col];
            y =
              drawWrapped(
                group.category.name,
                x,
                y,
                indexColumnW - 50,
                36,
                'bold 28px system-ui, sans-serif',
                '#305eaa'
              ) + 8;
            group.rows.forEach(({ number, p }) => {
              y =
                drawWrapped(
                  number + '. ' + (p.name || window.AppI18n.t('locationName')),
                  x + 10,
                  y,
                  indexColumnTextW,
                  30,
                  '22px system-ui, sans-serif',
                  '#26364d'
                ) + 8;
            });
            columns[col] = y + 24;
          });
          if (qrEnabled) {
            try {
              const qr = await renderQrCanvas(data.qrUrl, 116),
                qrX = width - 160,
                qrY = height - 160;
              ctx.fillStyle = '#fff';
              ctx.fillRect(qrX - 8, qrY - 8, 132, 152);
              ctx.drawImage(qr, qrX, qrY, 116, 116);
              const target = data.qrUrl.replace(/^https?:\/\//i, '');
              ctx.font = '11px system-ui, sans-serif';
              ctx.fillStyle = '#26364d';
              ctx.textAlign = 'center';
              let remaining = target;
              const targetLines = [];
              for (let index = 0; index < 2 && remaining; index++) {
                let length = remaining.length;
                while (
                  length > 1 &&
                  ctx.measureText(remaining.slice(0, length) + (length < remaining.length ? '…' : '')).width >
                    132
                )
                  length--;
                if (length < remaining.length && index === 0) {
                  const slash = remaining.slice(0, length).lastIndexOf('/');
                  if (slash > length * 0.65) length = slash + 1;
                }
                let line = remaining.slice(0, length);
                remaining = remaining.slice(length);
                if (remaining && index === 1) {
                  while (line && ctx.measureText(line + '…').width > 132) line = line.slice(0, -1);
                  line = line.replace(/[\s/?.#&_-]+$/, '') + '…';
                  remaining = '';
                }
                targetLines.push(line);
              }
              targetLines.forEach((line, index) => ctx.fillText(line, qrX + 58, qrY + 130 + index * 12, 132));
              ctx.textAlign = 'left';
            } catch (_) {
              alert(window.AppI18n.t('jpgExportFailed'));
              return;
            }
          }
          downloadJpg(canvas, 'map-poi-index.jpg', { quality: 0.96, dpi: printDpi });
        };
        source.onerror = () => alert(window.AppI18n.t('mapPdfImageFailed'));
        source.src = new URL(data.image, location.href).href;
      }
      async function renderQrCanvas(value, size) {
        if (!window.QRCode) throw new Error('QR generator unavailable');
        const host = document.createElement('div');
        host.style.cssText = 'position:fixed;left:-20000px;top:0;width:' + size + 'px;height:' + size + 'px;';
        document.body.appendChild(host);
        try {
          new window.QRCode(host, {
            text: value,
            width: size,
            height: size,
            colorDark: '#111111',
            colorLight: '#ffffff',
            correctLevel: window.QRCode.CorrectLevel.M,
          });
          const canvas = host.querySelector('canvas');
          if (canvas) return canvas;
          const image = host.querySelector('img');
          if (image) {
            if (!image.complete)
              await new Promise((resolve, reject) => {
                image.onload = resolve;
                image.onerror = reject;
              });
            const qr = document.createElement('canvas');
            qr.width = size;
            qr.height = size;
            qr.getContext('2d').drawImage(image, 0, 0, size, size);
            return qr;
          }
          throw new Error('QR generation failed');
        } finally {
          host.remove();
        }
      }
      const hasEventText = (id, day, event) => !!String(event?.text || '').trim();
      async function exportTimetableJpg() {
        const entries = [
          ...(data.pois || [])
            .filter((p) => p.hasProgram)
            .map((p) => ({
              name: p.name || window.AppI18n.t('locationName'),
              id: p.id,
              program: p.program,
              events: p.program?.[getSelectedDay()] || [],
            })),
          ...(data.timelines || []).slice(0, 3).map((timeline) => ({
            name: timeline.name,
            id: timeline.id,
            program: timeline.program,
            events: timeline.program?.[getSelectedDay()] || [],
          })),
        ].filter(
          (entry) =>
            entry.events.some((event) => event && String(event.text || '').trim()) ||
            timelineItems(entry.id, entry.program, getSelectedDay(), hasEventText).length
        );
        if (!entries.length) {
          alert(window.AppI18n.t('noProgramPois'));
          return;
        }
        if (document.fonts?.ready) await document.fonts.ready;
        const eventsByPoi = entries.map((entry) =>
          entry.events
            .filter((e) => e && String(e.text || '').trim())
            .slice()
            .sort((a, b) => (a.start || a.time || '').localeCompare(b.start || b.time || ''))
        );
        const itemsByPoi = entries.map((entry) =>
          timelineItems(entry.id, entry.program, getSelectedDay(), hasEventText)
        );
        const usedCategoryKeys = [
          ...new Set(
            eventsByPoi.flatMap((events) =>
              events.flatMap((e) => (Array.isArray(e.categories) ? e.categories : []))
            )
          ),
        ].filter((key) => eventCategories.some(([candidate]) => candidate === key));
        const categoryLabel = (key) =>
          window.AppI18n.t('eventCategory' + key[0].toUpperCase() + key.slice(1));
        const iconGlyph = (iconName) => {
          const el = document.createElement('i');
          el.className = 'fa-solid ' + iconName;
          document.body.appendChild(el);
          const content = getComputedStyle(el, '::before').content;
          el.remove();
          const match = content.match(/\\([0-9a-f]{1,6})/i);
          return match ? String.fromCodePoint(parseInt(match[1], 16)) : '';
        };
        const width = 3000,
          labelWidth = 340,
          timelineWidth = width - labelWidth - 80,
          x0 = labelWidth + 45,
          headerHeight = 170,
          rowGap = 24,
          detailHeadingHeight = 86,
          legendHeadingHeight = 92,
          legendRowHeight = 74,
          descriptionX = 650,
          descriptionWidth = width - descriptionX - 70;
        const measureCtx = document.createElement('canvas').getContext('2d');
        measureCtx.font = 'italic 15px system-ui, sans-serif';
        const wrapDescription = (value) => {
          const lines = [];
          let current = '',
            truncated = false;
          const push = () => {
            lines.push(current);
            current = '';
          };
          const paragraphs = String(value || '')
            .replace(/\r/g, '')
            .split('\n');
          for (let pi = 0; pi < paragraphs.length && !truncated; pi++) {
            const words = paragraphs[pi].split(/\s+/).filter(Boolean);
            if (!words.length) {
              if (pi < paragraphs.length - 1) {
                if (lines.length >= 5) {
                  truncated = true;
                  break;
                }
                push();
              }
              continue;
            }
            for (const word of words) {
              let rest = word;
              while (rest) {
                const candidate = current ? current + ' ' + rest : rest;
                if (measureCtx.measureText(candidate).width <= descriptionWidth) {
                  current = candidate;
                  rest = '';
                  continue;
                }
                if (current) {
                  push();
                  if (lines.length >= 5) {
                    truncated = true;
                    break;
                  }
                }
                let cut = rest.length;
                while (cut > 1 && measureCtx.measureText(rest.slice(0, cut)).width > descriptionWidth) cut--;
                current = rest.slice(0, cut);
                rest = rest.slice(cut);
                if (rest) {
                  push();
                  if (lines.length >= 5) {
                    truncated = true;
                    break;
                  }
                }
              }
              if (truncated) break;
            }
            if (pi < paragraphs.length - 1 && !truncated) {
              if (lines.length >= 5) truncated = true;
              else push();
            }
          }
          if (!truncated && current) push();
          if (truncated) {
            if (current && lines.length < 5) push();
            if (!lines.length) lines.push('');
            let last = lines[Math.min(lines.length, 5) - 1];
            while (last && measureCtx.measureText(last + '..').width > descriptionWidth)
              last = last.slice(0, -1);
            lines[Math.min(lines.length, 5) - 1] = last.replace(/[\s.,;:!?-]+$/, '') + '..';
          }
          return lines.slice(0, 5);
        };
        const descriptionsByPoi = eventsByPoi.map((events) =>
          events.map((event) => wrapDescription(event.description))
        );
        const wrapEventTitle = (value, maxWidth, maxLines = 3) => {
          measureCtx.font = 'bold 24px system-ui, sans-serif';
          const words = String(value || '')
              .trim()
              .split(/\s+/)
              .filter(Boolean),
            lines = [];
          let line = '',
            truncated = false;
          for (let i = 0; i < words.length; i++) {
            const word = words[i],
              candidate = line ? line + ' ' + word : word;
            if (measureCtx.measureText(candidate).width <= maxWidth) {
              line = candidate;
              continue;
            }
            if (line) {
              lines.push(line);
              line = word;
              if (lines.length >= maxLines) {
                truncated = true;
                break;
              }
            } else {
              line = word;
              truncated = true;
              break;
            }
          }
          if (!truncated && line) {
            lines.push(line);
            if (measureCtx.measureText(line).width > maxWidth) truncated = true;
          }
          if (lines.length > maxLines) {
            lines.length = maxLines;
            truncated = true;
          }
          if (truncated) {
            if (line && lines.length < maxLines) lines.push(line);
            if (lines.length > maxLines) lines.length = maxLines;
            if (!lines.length) lines.push('');
            let last = lines[lines.length - 1];
            while (last && measureCtx.measureText(last + '..').width > maxWidth) last = last.slice(0, -1);
            lines[lines.length - 1] = last.replace(/[\s.,;:!?-]+$/, '') + '..';
          }
          return lines.slice(0, maxLines);
        };
        const rowHeights = itemsByPoi.map((items) => {
          let lanes = [];
          items.forEach(({ start, end }) => {
            const lane = lanes.findIndex((v) => v <= start);
            if (lane < 0) lanes.push(end);
            else lanes[lane] = end;
          });
          return Math.max(154, lanes.length * 160 + 24);
        });
        const detailRowHeights = eventsByPoi.map((events, index) =>
          events.map((event, eventIndex) =>
            Math.max(82, 48 + descriptionsByPoi[index][eventIndex].length * 23)
          )
        );
        const detailHeight = detailRowHeights.flat().reduce((sum, n) => sum + n, 0),
          detailStart = headerHeight + rowHeights.reduce((a, b) => a + b + rowGap, 0) + 24,
          legendStart = detailStart + detailHeadingHeight + detailHeight + 28,
          height =
            legendStart +
            legendHeadingHeight +
            Math.ceil(usedCategoryKeys.length / 3) * legendRowHeight +
            140;
        const targetScale = 7016 / width,
          maxPixels = 40000000,
          maxDimension = 32767,
          scale = Math.min(
            targetScale,
            Math.sqrt(maxPixels / (width * height)),
            maxDimension / Math.max(width, height)
          ),
          printDpi = Math.max(1, Math.round((300 * scale) / targetScale));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        const ctx = canvas.getContext('2d');
        ctx.scale(scale, scale);
        ctx.fillStyle = '#fffaf3';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#305eaa';
        ctx.font = 'bold 54px system-ui, sans-serif';
        ctx.fillText(
          (data.title || window.AppI18n.t('timetable')) +
            ' — ' +
            window.AppI18n.t('day' + getSelectedDay()[0].toUpperCase() + getSelectedDay().slice(1)),
          45,
          72
        );
        ctx.font = '20px system-ui, sans-serif';
        ctx.fillStyle = '#26364d';
        ctx.fillText(window.AppI18n.t('timetableRowHeading'), 45, 144);
        for (let hour = 0; hour <= 24; hour++) {
          const x = x0 + (timelineWidth * hour) / 24;
          ctx.strokeStyle = '#ccB7a5';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x, headerHeight - 8);
          ctx.lineTo(x, detailStart - 18);
          ctx.stroke();
          if (hour < 24) {
            ctx.fillStyle = '#26364d';
            ctx.font = '17px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(String(hour).padStart(2, '0') + ':00', x + timelineWidth / 48, headerHeight - 20);
          }
        }
        let y = headerHeight;
        entries.forEach((p, index) => {
          const rowH = rowHeights[index];
          ctx.fillStyle = index % 2 ? '#f5eadd' : '#fffaf3';
          ctx.fillRect(0, y, width, rowH);
          ctx.strokeStyle = '#ccB7a5';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(0, y + rowH);
          ctx.lineTo(width, y + rowH);
          ctx.stroke();
          ctx.fillStyle = '#305eaa';
          ctx.font = 'bold 24px system-ui, sans-serif';
          ctx.textAlign = 'left';
          const poiName = p.name || window.AppI18n.t('locationName');
          const words = poiName.split(/\s+/);
          let line = '',
            lines = [];
          words.forEach((word) => {
            const next = line ? line + ' ' + word : word;
            if (ctx.measureText(next).width > labelWidth - 30 && line) {
              lines.push(line);
              line = word;
            } else line = next;
          });
          if (line) lines.push(line);
          lines.slice(0, 3).forEach((text, i) => ctx.fillText(text, 24, y + 38 + i * 29));
          const lanes = [];
          itemsByPoi[index].forEach((item) => {
            const { event, start, end } = item;
            let lane = lanes.findIndex((v) => v <= start);
            if (lane < 0) {
              lane = lanes.length;
              lanes.push(end);
            } else lanes[lane] = end;
            const bx = x0 + (timelineWidth * start) / 1440,
              bw = Math.max(22, (timelineWidth * (end - start)) / 1440),
              by = y + 12 + lane * 160,
              titleLines = wrapEventTitle(event.text, Math.max(0, bw - 20), 3),
              selected = (Array.isArray(event.categories) ? event.categories : [])
                .map((key) => eventCategories.find(([candidate]) => candidate === key))
                .filter(Boolean),
              boxHeight = 143;
            ctx.fillStyle = eventBoxColor(event.categories);
            ctx.beginPath();
            ctx.roundRect(bx, by, bw, boxHeight, 10);
            ctx.fill();
            ctx.save();
            ctx.beginPath();
            ctx.rect(bx + 6, by + 5, Math.max(0, bw - 12), boxHeight - 10);
            ctx.clip();
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'left';
            ctx.font = 'bold 20px system-ui, sans-serif';
            ctx.fillText(eventTimeLabel(event, item), bx + 10, by + 25);
            ctx.font = 'bold 24px system-ui, sans-serif';
            titleLines.forEach((titleLine, lineIndex) =>
              ctx.fillText(titleLine, bx + 10, by + 50 + lineIndex * 26)
            );
            if (selected.length) {
              ctx.font = '900 20px "Font Awesome 7 Free"';
              selected.forEach((category, iconIndex) => {
                const glyph = iconGlyph(category[1]);
                if (glyph) ctx.fillText(glyph, bx + 10 + iconIndex * 27, by + boxHeight - 10);
              });
            }
            ctx.restore();
          });
          y += rowH + rowGap;
        });
        ctx.textAlign = 'left';
        ctx.fillStyle = '#305eaa';
        ctx.font = 'bold 38px system-ui, sans-serif';
        ctx.fillText(
          window.AppI18n.lang() === 'en' ? 'Event details' : 'Veranstaltungen',
          45,
          detailStart + 42
        );
        let detailY = detailStart + detailHeadingHeight;
        eventsByPoi.forEach((events, index) =>
          events.forEach((event, eventIndex) => {
            const start = event.start || event.time || '00:00',
              end = event.end ? `–${event.end}${eventSpan(event).overnight ? ' (+1)' : ''}` : '',
              selected = (Array.isArray(event.categories) ? event.categories : [])
                .map((key) => eventCategories.find(([candidate]) => candidate === key))
                .filter(Boolean);
            ctx.fillStyle = eventBoxColor(event.categories);
            ctx.fillRect(48, detailY - 25, 10, 54);
            ctx.fillStyle = '#26364d';
            ctx.font = 'bold 20px system-ui, sans-serif';
            ctx.fillText(
              `${entries[index].name || window.AppI18n.t('locationName')} · ${start}${end}`,
              76,
              detailY
            );
            ctx.font = 'bold 22px system-ui, sans-serif';
            const eventTitle = String(event.text),
              eventTitleWidth = Math.min(ctx.measureText(eventTitle).width, 1450);
            ctx.fillText(eventTitle, 650, detailY, 1450);
            selected.forEach((category, iconIndex) => {
              const centerX = 650 + eventTitleWidth + 18 + iconIndex * 34,
                centerY = detailY - 7;
              ctx.beginPath();
              ctx.arc(centerX, centerY, 12, 0, Math.PI * 2);
              ctx.fillStyle = category[2];
              ctx.fill();
              const glyph = iconGlyph(category[1]);
              if (glyph) {
                ctx.fillStyle = contrastTextColor(category[2]);
                ctx.font = '900 13px "Font Awesome 7 Free"';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(glyph, centerX, centerY);
              }
            });
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';
            ctx.font = 'italic 19px system-ui, sans-serif';
            ctx.fillStyle = '#6c6259';
            descriptionsByPoi[index][eventIndex].forEach((line, lineIndex) =>
              ctx.fillText(line, descriptionX, detailY + 22 + lineIndex * 23)
            );
            detailY += detailRowHeights[index][eventIndex];
          })
        );
        ctx.fillStyle = '#305eaa';
        ctx.font = 'bold 38px system-ui, sans-serif';
        ctx.fillText(
          window.AppI18n.lang() === 'en' ? 'Category icon key' : 'Kategorien und Symbole',
          45,
          legendStart + 42
        );
        usedCategoryKeys.forEach((key, index) => {
          const category = eventCategories.find(([candidate]) => candidate === key);
          if (!category) return;
          const col = index % 3,
            row = Math.floor(index / 3),
            x = 55 + col * 980,
            baseY = legendStart + legendHeadingHeight + row * legendRowHeight;
          ctx.fillStyle = category[2];
          ctx.beginPath();
          ctx.arc(x + 18, baseY - 9, 23, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = contrastTextColor(category[2]);
          ctx.font = '900 24px "Font Awesome 7 Free"';
          ctx.textAlign = 'center';
          const glyph = iconGlyph(category[1]);
          if (glyph) ctx.fillText(glyph, x + 18, baseY - 1);
          ctx.textAlign = 'left';
          ctx.fillStyle = '#26364d';
          ctx.font = 'bold 21px system-ui, sans-serif';
          ctx.fillText(categoryLabel(key), x + 58, baseY);
        });
        if (typeof data.qrUrl === 'string' && /^https?:\/\//i.test(data.qrUrl)) {
          const qrSize = 80,
            qr = await renderQrCanvas(data.qrUrl, qrSize),
            qrX = width - 150,
            rowCount = Math.ceil(usedCategoryKeys.length / 3),
            lastCategoryRowY = rowCount
              ? legendStart + legendHeadingHeight + (rowCount - 1) * legendRowHeight
              : height - 140,
            qrY = rowCount ? lastCategoryRowY - 52 : height - 138;
          ctx.fillStyle = '#fff';
          ctx.fillRect(qrX - 8, qrY - 8, 96, 122);
          ctx.drawImage(qr, qrX, qrY, qrSize, qrSize);
          const target = data.qrUrl.replace(/^https?:\/\//i, '');
          ctx.font = '11px system-ui, sans-serif';
          ctx.fillStyle = '#26364d';
          ctx.textAlign = 'center';
          let remaining = target;
          const targetLines = [];
          for (let index = 0; index < 2 && remaining; index++) {
            let length = remaining.length;
            while (
              length > 1 &&
              ctx.measureText(remaining.slice(0, length) + (length < remaining.length ? '…' : '')).width > 132
            )
              length--;
            if (length < remaining.length && index === 0) {
              const slash = remaining.slice(0, length).lastIndexOf('/');
              if (slash > length * 0.65) length = slash + 1;
            }
            let line = remaining.slice(0, length);
            remaining = remaining.slice(length);
            if (remaining && index === 1) {
              while (line && ctx.measureText(line + '…').width > 132) line = line.slice(0, -1);
              line = line.replace(/[\s/?.#&_-]+$/, '') + '…';
              remaining = '';
            }
            targetLines.push(line);
          }
          targetLines.forEach((line, index) => ctx.fillText(line, qrX + 40, qrY + 96 + index * 12, 132));
          ctx.textAlign = 'left';
        }
        downloadJpg(canvas, 'www-' + getSelectedDay() + '.jpg', { quality: 0.96, dpi: printDpi });
      }
      return { exportMapJpg, exportTimetableJpg };
    },
  };
})();


        (function() {
            const secretEl = document.getElementById('secret');
            const codeEl = document.getElementById('parcelCode');
            const timeEl = document.getElementById('time');
            const locEl = document.getElementById('location');
            const eventEl = document.getElementById('event');
            const statusEl = document.getElementById('status');
            const logEl = document.getElementById('log');
            const preview = document.getElementById('preview');
            const scanStatus = document.getElementById('scan-status');
            const startBtn = document.getElementById('start-scan');
            const stopBtn = document.getElementById('stop-scan');
            const rescanBtn = document.getElementById('rescan');
            const sendScanBtn = document.getElementById('send-scan');
            const scanActions = document.getElementById('scan-actions');
            const retreatToggle = document.getElementById('retreat-toggle');
            const sendBtn = document.getElementById('send');
            const scanOverlay = document.getElementById('scan-overlay');
            const scanCode = document.getElementById('scan-code');
            const scanState = document.getElementById('scan-state');
            const edgeFlash = document.getElementById('edge-flash');

            const API_BASE = (location.port === '5500') ? 'http://localhost:3000' : '';
            const WRITE_URL = `${API_BASE}/api/parcel-updates`;

            function setDefaultTime() {
                const now = new Date();
                timeEl.value = now.toISOString();
            }

            function startClock() {
                setDefaultTime();
                setInterval(() => {
                    if (document.activeElement !== timeEl) {
                        setDefaultTime();
                    }
                }, 1000);
            }
            startClock();

            function log(msg, data) {
                const time = new Date().toISOString();
                const body = data ? `\n${JSON.stringify(data, null, 2)}` : '';
                logEl.textContent = `[${time}] ${msg}${body}`;
            }

            function updateScanOverlay(code, state) {
                if (code !== undefined) {
                    scanCode.textContent = code || 'Chưa quét';
                }
                if (state !== undefined) {
                    scanState.textContent = state;
                }
            }

            function flashEdge(kind) {
                edgeFlash.classList.remove('flash-success', 'flash-error');
                void edgeFlash.offsetWidth;
                edgeFlash.classList.add(kind === 'success' ? 'flash-success' : 'flash-error');
            }

            let stream;
            let scanning = false;
            let detector;

            async function initDetector() {
                if ('BarcodeDetector' in window) {
                    const formats = ['code_128', 'code_39', 'code_93', 'ean_13', 'ean_8', 'qr_code', 'upc_a', 'upc_e', 'codabar', 'itf', 'aztec', 'data_matrix', 'pdf417'];
                    detector = new window.BarcodeDetector({ formats });
                    return true;
                }
                return false;
            }

            async function startScan() {
                if (scanning) return;
                const supported = await initDetector();
                if (!supported) {
                    scanStatus.textContent = 'Thiết bị không hỗ trợ BarcodeDetector. Nhập tay mã vận đơn.';
                    updateScanOverlay(undefined, 'Thiết bị không hỗ trợ quét. Nhập tay mã vận đơn.');
                    return;
                }
                try {
                    stream = await navigator.mediaDevices.getUserMedia({
                        video: { facingMode: { ideal: 'environment' } },
                        audio: false
                    });
                    preview.srcObject = stream;
                    await preview.play();
                    scanning = true;
                    scanStatus.textContent = 'Đang quét...';
                    updateScanOverlay(undefined, 'Đang quét...');
                    scanActions.classList.remove('active');
                    requestAnimationFrame(tickScan);
                } catch (err) {
                    scanStatus.textContent = 'Không mở được camera. Cho phép quyền hoặc nhập tay.';
                    updateScanOverlay(undefined, 'Không mở được camera.');
                }
            }

            function stopScan(reason) {
                scanning = false;
                if (stream) {
                    stream.getTracks().forEach(t => t.stop());
                    stream = null;
                }
                preview.pause();
                preview.srcObject = null;
                if (reason !== 'scanned') {
                    scanStatus.textContent = 'Camera dừng.';
                    updateScanOverlay(undefined, 'Camera dừng.');
                    scanActions.classList.remove('active');
                }
            }

            async function tickScan() {
                if (!scanning || !detector || preview.readyState < 2) return;
                try {
                    const barcodes = await detector.detect(preview);
                    if (barcodes && barcodes.length) {
                        const value = barcodes[0].rawValue || barcodes[0].rawData || barcodes[0].displayValue;
                        if (value) {
                            codeEl.value = value.trim();
                            scanStatus.textContent = `Đã quét: ${value}`;
                            updateScanOverlay(value.trim(), 'Đã quét thành công.');
                            stopScan('scanned');
                            scanActions.classList.add('active');
                            return;
                        }
                    }
                } catch (err) {
                    scanStatus.textContent = 'Lỗi quét, thử lại hoặc nhập tay.';
                    updateScanOverlay(undefined, 'Lỗi quét, thử lại.');
                }
                if (scanning) requestAnimationFrame(tickScan);
            }

            startBtn.addEventListener('click', startScan);
            stopBtn.addEventListener('click', () => stopScan());
            rescanBtn.addEventListener('click', () => {
                codeEl.value = '';
                updateScanOverlay('Chưa quét', 'Đang quét...');
                startScan();
            });

            retreatToggle.addEventListener('click', () => {
                const isRetreated = document.body.classList.toggle('is-retreated');
                retreatToggle.textContent = isRetreated ? 'Hiện cấu hình' : 'Thu gọn cấu hình';
            });

            async function sendRequest() {
                const payload = {
                    secret: secretEl.value,
                    mode: 'CREATE',
                    parcelCode: codeEl.value.trim(),
                    data: {
                        time: timeEl.value.trim(),
                        event: eventEl.value.trim() || 'Nhập kho',
                        location: locEl.value.trim() || 'Hà Nội'
                    }
                };

                if (!payload.secret) {
                    statusEl.textContent = 'Thao tác cần xác thực nhân viên qua hệ thống.';
                    statusEl.className = 'status error';
                    updateScanOverlay(undefined, 'Cần xác thực nhân viên.');
                    flashEdge('error');
                    return;
                }
                const auth = await fetch(WRITE_URL, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action: 'verify', secret: payload.secret})}).catch(() => null);
                if (!auth?.ok) { statusEl.textContent = 'Không thể xác thực.'; return; }
                if (!payload.parcelCode) {
                    statusEl.textContent = 'Chưa có mã vận đơn.';
                    statusEl.className = 'status error';
                    updateScanOverlay(undefined, 'Chưa có mã vận đơn.');
                    flashEdge('error');
                    return;
                }

                statusEl.textContent = 'Đang gửi...';
                statusEl.className = 'status muted';
                updateScanOverlay(payload.parcelCode, 'Đang gửi yêu cầu...');
                try {
                    const res = await fetch(WRITE_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    const body = await res.json().catch(() => ({}));
                    if (!res.ok) throw body;
                    statusEl.textContent = 'Đã gửi thành công';
                    statusEl.className = 'status success';
                    updateScanOverlay(payload.parcelCode, 'Đã gửi thành công.');
                    flashEdge('success');
                    log('Write OK', body);
                    setDefaultTime();
                } catch (err) {
                    statusEl.textContent = 'Lỗi gửi';
                    statusEl.className = 'status error';
                    updateScanOverlay(payload.parcelCode, 'Gửi thất bại.');
                    flashEdge('error');
                    log('Write failed', err);
                }
            }

            sendBtn.addEventListener('click', sendRequest);
            sendScanBtn.addEventListener('click', sendRequest);
        })();

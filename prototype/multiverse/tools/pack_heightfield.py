# heightfield.bin (float32 planes, from export_scene.py) -> heightfield.i16.bin (int16 planes, 2 cm steps)
# header: u32 nx, u32 nz, f32 x0, f32 x1, f32 y0, f32 y1, f32 step; then A, M, P as int16 (value = q * step)
import struct, sys
import numpy as np
src, dst = sys.argv[1], sys.argv[2]
b = open(src, 'rb').read()
nx, nz, x0, x1, y0, y1 = struct.unpack('<IIffff', b[:24])
n = nx * nz
planes = np.frombuffer(b[24:24 + n * 12], dtype='<f4').reshape(3, n)
STEP = 0.02
q = np.clip(np.round(planes / STEP), -32767, 32767).astype('<i2')
print('max abs error (m):', float(np.abs(q.astype(np.float32) * STEP - planes).max()), 'range', planes.min(), planes.max())
with open(dst, 'wb') as f:
    f.write(struct.pack('<IIfffff', nx, nz, x0, x1, y0, y1, STEP))
    f.write(q.tobytes())

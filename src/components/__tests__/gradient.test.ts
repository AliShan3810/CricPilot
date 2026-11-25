jest.mock('react-native-svg', () => ({}));
import { splitStop } from '../Gradient';

describe('gradient stop colours', () => {
  it('splits rgba() into a solid colour and opacity', () => {
    expect(splitStop('rgba(11,17,32,0.55)')).toEqual({ color: '#0b1120', opacity: 0.55 });
    expect(splitStop('rgb(255, 107, 0)')).toEqual({ color: '#ff6b00', opacity: 1 });
    expect(splitStop('#FF6B0080')).toEqual({ color: '#FF6B00', opacity: 128 / 255 });
    expect(splitStop('#0D1117')).toEqual({ color: '#0D1117', opacity: 1 });
  });
});

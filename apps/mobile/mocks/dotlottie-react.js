const React = require('react');

class DotLottie {
  addEventListener() {}
  removeEventListener() {}
  play() {}
  pause() {}
  stop() {}
  seek() {}
  destroy() {}
}

const DotLottieReact = React.forwardRef((props, ref) => {
  return React.createElement('div', {
    ref,
    style: {
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    'data-testid': 'dotlottie-mock',
  });
});

module.exports = {
  DotLottie,
  DotLottieReact,
};


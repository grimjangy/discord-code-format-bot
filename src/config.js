function getPrintWidth() {
  const configuredWidth = Number.parseInt(process.env.FORMAT_PRINT_WIDTH || '80', 10);

  if (Number.isNaN(configuredWidth) || configuredWidth < 40) {
    return 80;
  }

  return configuredWidth;
}

module.exports = {
  getPrintWidth
};

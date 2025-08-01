module.exports = {
  default: ["--require step_definitions/**/*.js", "features/**/*.feature"].join(
    " "
  ),
};

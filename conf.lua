function love.conf(t)
  t.identity = "vulnerable"
  t.version = "11.4"
  t.window.title = "Vulnerable"
  t.window.width = 1280
  t.window.height = 720
  t.window.minwidth = 640
  t.window.minheight = 360
  t.window.resizable = true
  t.window.highdpi = true
  t.window.msaa = 4
  t.modules.joystick = false
  t.modules.physics = false
  t.modules.video = false
end

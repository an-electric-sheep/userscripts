#! /usr/bin/ruby

require "pathname"
require 'tmpdir'
require "shellwords"

ARGV.each do |zip|
  Dir.mktmpdir do |dir|
    `unzip #{zip.shellescape} -d #{dir.shellescape}`

    frames = Pathname.new(dir).join("frame_delays.txt").read.split("\n").map{|l| l.split("\t")}

    puts frames.inspect

    input_files = frames.map do |f|
      name = f[0]
      delay = f[1]
      "-delay #{delay}x1000 #{Pathname.new(dir).join(name)}"
    end.join(" ")

    # perform frame and transparency gif optimizations
    # TODO: (maybe) add options for palette and dithering optimizations
    `convert #{input_files} -layers Optimize +dither #{zip.gsub(".zip", ".gif")}`

  end
end

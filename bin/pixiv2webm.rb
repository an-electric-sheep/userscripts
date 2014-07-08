#! /usr/bin/ruby

require "pathname"
require 'tmpdir'
require "shellwords"

ARGV.each do |zip|
  Dir.mktmpdir do |dir|
    `unzip #{zip.shellescape} -d #{dir.shellescape}`

    frames = Pathname.new(dir).join("frame_delays.txt").read.split("\n").map{|l| l.split("\t")}

    extension = Pathname.new(frames.first[0]).extname

    timecodes_path = Pathname.new(dir).join("mkv_timecodes.txt")
    timecodes = ["# timecode format v2"]
    frames.map{|f| f[1].to_i}.reduce(0){|prev, acc| timecodes << prev;acc+prev}

    timecodes_path.write(timecodes.join("\n"))

    intermediate = Pathname.new(dir).join("tmp.mkv")
    passlog = Pathname.new(dir).join("pass.log")

    puts `ffmpeg -y -r 10 -i '#{dir}/%06d#{extension}' -c:v libvpx -an -quality best -crf 4 -b:v 2M -pass 1 -passlogfile #{passlog} #{intermediate}`
    puts `ffmpeg -y -r 10 -i '#{dir}/%06d#{extension}' -c:v libvpx -an -quality best -crf 4 -b:v 2M -pass 2 -passlogfile #{passlog} #{intermediate}`

    # turn constant framerate mkv into vfr
    puts `mkvmerge -v -w -o #{zip.gsub(".zip", ".webm")} --timecodes 0:#{timecodes_path} #{intermediate}`
  end
end

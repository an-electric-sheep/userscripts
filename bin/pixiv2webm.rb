#! /usr/bin/ruby

require "pathname"
require 'tmpdir'
require "shellwords"

ARGV.each do |zip|
  Dir.mktmpdir do |dir|
    `unzip #{zip.shellescape} -d #{dir.shellescape}`

    tmpdir = Pathname.new(dir)

    frames = tmpdir.join("frame_delays.txt").read.split("\n").map{|l| l.split("\t")}

    extension = Pathname.new(frames.first[0]).extname


    last_file = frames.last[0]

    # insert a duplicate frame for looping content since we can only encode offsets not individual frame durations
    terminator_frame = sprintf("%06d", last_file.to_i + 1) + ".#{extension}"
    FileUtils.cp(tmpdir.join(last_file), tmpdir.join(terminator_frame))

    timecodes_path = tmpdir.join("mkv_timecodes.txt")
    timecodes = ["# timecode format v2", "0"]
    frames.map{|f| f[1].to_i}.reduce(0){|prev, acc| acc+=prev; timecodes << acc;acc}

    timecodes_path.write(timecodes.join("\n"))

    intermediate = tmpdir.join("tmp.mkv")
    passlog = tmpdir.join("pass.log")

    puts `ffmpeg -y -r 10 -i '#{dir}/%06d#{extension}' -c:v libvpx -an -quality best -crf 4 -b:v 2M -pass 1 -passlogfile #{passlog} #{intermediate}`
    puts `ffmpeg -y -r 10 -i '#{dir}/%06d#{extension}' -c:v libvpx -an -quality best -crf 4 -b:v 2M -pass 2 -passlogfile #{passlog} #{intermediate}`

    # turn constant framerate mkv into vfr
    puts `mkvmerge -v -w -o #{zip.gsub(".zip", ".webm")} --timecodes 0:#{timecodes_path} #{intermediate}`
  end
end

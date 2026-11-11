# Run inside the pinned trmnlp image after illustrations/render-samples.cjs.
require 'json'
require 'fileutils'
require 'trmnl/liquid'

root = File.expand_path('..', __dir__)
shared = File.read(File.join(root, 'src/shared.liquid'))
full = File.read(File.join(root, 'src/full.liquid'))
samples = JSON.parse(File.read(File.join(root, '_build/sample-inputs.json')))
directory = File.join(root, '_build/illustrations')
FileUtils.mkdir_p(directory)

samples.each do |name, data|
  environment = TRMNL::Liquid.new
  html = Liquid::Template.parse(shared + full, environment: environment).render!(data)
  raise "#{name}: Liquid error" if html.include?('Liquid error:')
  figures = html.scan(/<svg class="htd-mannequin.*?<\/svg>/m)
  expected = data['stages'].sum { |stage| stage['alt'] ? 2 : 1 }
  raise "#{name}: #{figures.length} mannequins, expected #{expected}" unless figures.length == expected
  ids = html.scan(/<clipPath id="([^"]+)"/).flatten
  raise "#{name}: duplicate clipping IDs" unless ids.uniq.length == ids.length
  refs = html.scan(/clip-path="url\(#([^\)]+)\)"/).flatten
  raise "#{name}: missing clipping shape" unless (refs - ids).empty?
  figures.each_with_index do |figure, i|
    %w[gants mitaines bottesHiver bottesPluie souliers].each do |key|
      raise "#{name}: duplicated #{key}" if figure.scan(/data-item="#{key}"/).length > 1
    end
    if figure.include?('data-item="gants"') || figure.include?('data-item="mitaines"')
      raise "#{name}: bare hands under gloves" if figure.include?('data-layer="bare-hands"')
    end
    if figure.include?('data-item="impermeable"')
      raise "#{name}: hair behind rain hood" if figure.include?('data-layer="hair-back"')
      raise "#{name}: missing front of hood" unless figure.include?('data-side="headFront"')
    end
    if figure.include?('data-item="neige"') && figure.include?('data-item="bottesHiver"')
      raise "#{name}: pants over boots" unless figure.index('data-item="neige"') < figure.index('data-item="bottesHiver"')
    end
    File.write(File.join(directory, "#{name}-#{i + 1}.svg"), figure.sub('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '))
  end
  File.write(File.join(directory, "#{name}.html"), html)
  puts "PASS #{name}: #{figures.length} mannequins, valid clipping and layer order"
end

# Run inside the pinned trmnlp image after illustrations/render-samples.cjs.
require 'json'
require 'fileutils'
require 'trmnl/liquid'
require 'nokogiri'

root = File.expand_path('..', __dir__)
shared = File.read(File.join(root, 'src/shared.liquid'))
full = File.read(File.join(root, 'src/full.liquid'))
samples = JSON.parse(File.read(File.join(root, '_build/sample-inputs.json')))
samples['missing-weather'] = { 'error' => 'Pas de météo pour le moment.' }
directory = File.join(root, '_build/illustrations')
FileUtils.mkdir_p(directory)

samples.each do |name, data|
  environment = TRMNL::Liquid.new
  html = Liquid::Template.parse(shared + full, environment: environment).render!(data)
  raise "#{name}: Liquid error" if html.include?('Liquid error:')
  document = Nokogiri::HTML.fragment(html)
  if data['error']
    raise 'Missing error message' unless document.text.include?(data['error'])
    raise 'Error renders dashboard' unless document.css('.htd-dashboard').empty?
  else
    expected = data['stages'].sum { |stage| stage['alt'] ? 2 : 1 }
    raise "#{name}: missing mannequin" unless document.css('.mq').length == expected
    raise "#{name}: phrase must have two lines" unless document.css('.fr > span').length == 2
    raise "#{name}: missing cards" unless document.css('.cards h3').map(&:text) == ['Le ciel', 'Le soleil', 'La lune ce soir']
    raise "#{name}: missing chart" unless document.at_css('.bottom svg')
    raise "#{name}: SVG illustration fallback" unless document.css('.mq svg, .layers svg').empty?
    document.css('img').each do |image|
      file = image['src'].split('/images/').last
      raise "#{name}: missing #{file}" unless File.file?(File.join(root, 'images', file))
    end
  end
  File.write(File.join(directory, "#{name}.html"), html)
  puts "PASS #{name}: real Liquid render"
end

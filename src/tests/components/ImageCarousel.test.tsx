import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ImageCarousel from '@/components/ImageCarousel';

describe('ImageCarousel', () => {
  it('renders no carousel navigation controls for a single image', () => {
    render(
      <ImageCarousel
        images={['/uploads/front.jpg']}
        alt="Shrooms"
        href="/shop/shrooms"
      />,
    );

    expect(screen.getByAltText('Shrooms')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /next photo/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /previous photo/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('cycles photos with prev/next arrows and dots without firing onImageClick', () => {
    const onImageClick = jest.fn();
    render(
      <ImageCarousel
        images={['/uploads/front.jpg', '/uploads/back.jpg', '/uploads/detail.jpg']}
        alt="Bouquet Postcard"
        onImageClick={onImageClick}
        showCounter
      />,
    );

    expect(screen.getByText('1 / 3')).toBeInTheDocument();
    expect(screen.getByAltText('Bouquet Postcard')).toHaveAttribute(
      'src',
      expect.stringContaining('front.jpg'),
    );

    fireEvent.click(screen.getByRole('button', { name: /next photo of bouquet postcard/i }));
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
    expect(screen.getByAltText('Bouquet Postcard — photo 2 of 3')).toHaveAttribute(
      'src',
      expect.stringContaining('back.jpg'),
    );
    expect(onImageClick).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /photo 3 of 3/i }));
    expect(screen.getByText('3 / 3')).toBeInTheDocument();

    // Wraps back to slide 1
    fireEvent.click(screen.getByRole('button', { name: /next photo of bouquet postcard/i }));
    expect(screen.getByText('1 / 3')).toBeInTheDocument();

    // Wraps backward to last slide
    fireEvent.click(screen.getByRole('button', { name: /previous photo of bouquet postcard/i }));
    expect(screen.getByText('3 / 3')).toBeInTheDocument();
  });

  it('supports keyboard ArrowRight / ArrowLeft when enableKeyboard is enabled', () => {
    render(
      <ImageCarousel
        images={['/uploads/front.jpg', '/uploads/back.jpg']}
        alt="Mushroom Postcard"
        enableKeyboard
        showCounter
      />,
    );

    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });

  it('supports controlled activeIndex and touch swipe', () => {
    const onIndexChange = jest.fn();
    render(
      <ImageCarousel
        images={['/uploads/front.jpg', '/uploads/back.jpg']}
        alt="Postcard"
        activeIndex={0}
        onIndexChange={onIndexChange}
      />,
    );

    const region = screen.getByRole('region', { name: /postcard photos/i });
    fireEvent.touchStart(region, { touches: [{ clientX: 200, clientY: 100 }] });
    fireEvent.touchEnd(region, { changedTouches: [{ clientX: 120, clientY: 105 }] });

    expect(onIndexChange).toHaveBeenCalledWith(1);
  });

  it('renders still listing videos (no autoplay) and maps GIFs to static WebP posters', () => {
    const { container } = render(
      <ImageCarousel
        images={['/uploads/videos/studio-spin.mp4', '/uploads/images/loop.gif']}
        alt="Ceramic Vase"
        href="/shop/ceramic-vase"
        variantSize="thumb"
      />,
    );

    const video = container.querySelector('video');
    expect(video).not.toBeNull();
    expect(video).toHaveAttribute('src', '/uploads/videos/studio-spin.mp4');
    expect(video).not.toHaveAttribute('autoplay');
    expect(video).not.toHaveAttribute('loop');
    expect(video).not.toHaveAttribute('controls');
    expect(screen.getByText('Video')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /next photo of ceramic vase/i }));
    const img = screen.getByAltText('Ceramic Vase — photo 2 of 2');
    expect(img).toHaveAttribute('src', expect.stringContaining('loop-thumb.webp'));
  });

  it('renders interactive video controls without trapping inside zoom button or overlapping dots', () => {
    const onImageClick = jest.fn();
    const { container } = render(
      <ImageCarousel
        images={['/uploads/videos/studio-spin.mp4', '/uploads/images/front.jpg']}
        alt="Ceramic Vase"
        onImageClick={onImageClick}
        showCounter
      />,
    );

    const video = container.querySelector('video');
    expect(video).not.toBeNull();
    expect(video).toHaveAttribute('controls');
    expect(screen.queryByRole('button', { name: /inspect ceramic vase/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /video 1 of 2/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /next photo of ceramic vase/i }));
    expect(screen.getByRole('button', { name: /inspect ceramic vase/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /photo 2 of 2/i })).toBeInTheDocument();
  });
});
